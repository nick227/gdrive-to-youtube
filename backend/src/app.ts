import express, { Request, Response, NextFunction } from "express";
import session from "express-session";
import dotenv from "dotenv";
import path from "node:path";
import fs from "node:fs";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import rateLimit from "express-rate-limit";

import passport from "./auth/passport";
import { requireAuth } from "./auth/middleware";
import authRoutes from "./routes/auth";
import mediaRoutes from "./routes/media";
import uploadJobRoutes from "./routes/uploadJobs";
import renderJobRoutes from "./routes/renderJobs";
import youtubeVideoRoutes from "./routes/youtubeVideos";
import youtubeChannelRoutes from "./routes/youtubeChannels";
import mediaPreviewRoutes from "./routes/media-preview";
import prisma from "./prismaClient";
import { validateEnv } from "./config/validateEnv";

dotenv.config();
validateEnv();

const app = express();

/* =============================================================================
   CONFIGURATION
============================================================================= */

const isProd = process.env.NODE_ENV === "production";

// API routes that should NOT be caught by SPA fallback
const API_PREFIXES = [
  "/auth",
  "/media",
  "/videos",
  "/channels",
  "/media-preview",
  "/upload-jobs",
  "/render-jobs",
  "/health",
];

/* =============================================================================
   TRUST PROXY (Critical for Railway/Heroku/Render)
============================================================================= */

if (isProd) {
  // Railway terminates TLS and forwards with X-Forwarded-Proto
  // Without this, secure cookies won't work behind the proxy
  app.set("trust proxy", 1);
}

/* =============================================================================
   LOGGING
============================================================================= */

app.use(morgan(isProd ? "combined" : "dev"));

/* =============================================================================
   SECURITY HEADERS
============================================================================= */

// Helmet with CSP configured for Next.js SPA
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Next can need eval in some setups
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:", "blob:"],
        connectSrc: ["'self'"], // same-origin in prod (FE served from backend/public)
        fontSrc: ["'self'", "data:"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'", "blob:"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

app.use(compression());

/* =============================================================================
   RATE LIMITING
============================================================================= */

// Stricter rate limit for authentication endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: "Too many authentication attempts, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
});

// Standard rate limit for API endpoints (excludes /auth and static files)
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: isProd ? 100 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip /auth (has its own stricter limiter)
    if (req.path.startsWith("/auth")) return true;
    // Skip static files (only rate limit API routes)
    return !API_PREFIXES.some((prefix) => req.path.startsWith(prefix));
  },
});

app.use(apiLimiter);

/* =============================================================================
   BODY PARSER
============================================================================= */

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

/* =============================================================================
   CORS (Relaxed MVP: allow all origins)
============================================================================= */

// Note: Allowing "*" with credentials is invalid, so we reflect Origin when present.
// This is intentionally permissive for MVP; tighten later.
app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Vary", "Origin");
  }

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, PATCH, OPTIONS"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Requested-With"
  );

  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Max-Age", "86400");
    return res.sendStatus(204);
  }

  next();
});

/* =============================================================================
   SESSION CONFIGURATION
============================================================================= */

const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  throw new Error("SESSION_SECRET environment variable must be set");
}

// Only set cookie domain if explicitly configured for cross-subdomain sessions.
// For Railway's *.up.railway.app, leave undefined (same origin).
const cookieDomain =
  isProd && process.env.COOKIE_DOMAIN ? process.env.COOKIE_DOMAIN : undefined;

app.use(
  session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    name: "sessionId",
    proxy: isProd, // Trust X-Forwarded-Proto for secure cookies behind proxy
    cookie: {
      secure: isProd, // Requires HTTPS
      httpOnly: true, // Prevents XSS
      sameSite: "lax", // CSRF protection
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      ...(cookieDomain && { domain: cookieDomain }),
    },
  })
);

// Warn about MemoryStore limitations in production
if (isProd) {
  console.warn(
    "⚠️  WARNING: Using MemoryStore for sessions in production.\n" +
      "   Sessions will be lost on server restart and won't work with multiple instances.\n" +
      "   Consider connect-redis or connect-pg-simple for production."
  );
}

/* =============================================================================
   PASSPORT AUTHENTICATION
============================================================================= */

app.use(passport.initialize());
app.use(passport.session());

/* =============================================================================
   HEALTH CHECK
============================================================================= */

app.get("/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      ok: true,
      timestamp: new Date().toISOString(),
      database: "connected",
      environment: isProd ? "production" : "development",
      uptime: process.uptime(),
    });
  } catch (err) {
    res.status(503).json({
      ok: false,
      timestamp: new Date().toISOString(),
      database: "disconnected",
      error: String(err),
    });
  }
});

/* =============================================================================
   API ROUTES
============================================================================= */

// Authentication routes with stricter rate limiting
app.use("/auth", authLimiter, authRoutes);

// Public routes (adjust based on your security requirements)
app.use("/media", mediaRoutes);
app.use("/videos", youtubeVideoRoutes);
app.use("/channels", youtubeChannelRoutes);
app.use("/media-preview", mediaPreviewRoutes);

// Protected routes requiring authentication
app.use("/upload-jobs", requireAuth, uploadJobRoutes);
app.use("/render-jobs", requireAuth, renderJobRoutes);

/* =============================================================================
   STATIC FRONTEND (Production Only - Next build output in backend/public)
============================================================================= */

if (isProd) {
  const publicDir = path.resolve(__dirname, "../public");

  console.log(`📁 Static frontend directory: ${publicDir}`);

  if (fs.existsSync(publicDir)) {
    // Serve static files with aggressive caching (good for hashed assets)
    app.use(
      express.static(publicDir, {
        maxAge: "1y",
        immutable: true,
        etag: true,
        lastModified: true,
        setHeaders: (res, filePath) => {
          // Don't cache index.html (ensure deployments update immediately)
          if (filePath.endsWith("index.html")) {
            res.setHeader("Cache-Control", "no-cache, must-revalidate");
          }
        },
      })
    );

    // SPA fallback: serve index.html for all non-API routes
    app.get("*", (req, res, next) => {
      // Let API routes pass through to 404 handler
      if (API_PREFIXES.some((prefix) => req.path.startsWith(prefix))) {
        return next();
      }

      const indexPath = path.join(publicDir, "index.html");

      if (!fs.existsSync(indexPath)) {
        return res.status(404).send(
          "<!DOCTYPE html><html><body><h1>404 - Application Not Found</h1>" +
            "<p>The frontend application is not available.</p></body></html>"
        );
      }

      res.sendFile(indexPath, (err) => {
        if (err) {
          console.error("Error serving index.html:", err);
          next(err);
        }
      });
    });
  } else {
    console.error(`🚨 ERROR: Frontend directory not found: ${publicDir}`);
    console.error("   Make sure to copy your Next build output to backend/public/");
  }
}

/* =============================================================================
   ERROR HANDLERS
============================================================================= */

// 404 handler for API routes
app.use((req, res, next) => {
  if (API_PREFIXES.some((prefix) => req.path.startsWith(prefix))) {
    res.status(404).json({
      error: "Not Found",
      message: `Cannot ${req.method} ${req.path}`,
      path: req.path,
    });
  } else {
    next();
  }
});

// Global error handler
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  console.error("Unhandled error:", {
    message: err.message,
    stack: isProd ? undefined : err.stack,
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString(),
  });

  const message = isProd ? "Internal server error" : err.message;
  const statusCode = (err as any).statusCode || 500;

  res.status(statusCode).json({
    error: message,
    ...(isProd ? {} : { stack: err.stack }),
  });
});

/* =============================================================================
   GRACEFUL SHUTDOWN
============================================================================= */

const gracefulShutdown = async (signal: string) => {
  console.log(`\n${signal} received. Starting graceful shutdown...`);

  try {
    await prisma.$disconnect();
    console.log("✓ Database connections closed");

    console.log("✓ Graceful shutdown complete");
    process.exit(0);
  } catch (err) {
    console.error("Error during shutdown:", err);
    process.exit(1);
  }
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

process.on("uncaughtException", (err) => {
  console.error("FATAL - Uncaught Exception:", err);
  console.error("Process state corrupted. Exiting immediately.");
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  gracefulShutdown("UNHANDLED_REJECTION");
});

/* =============================================================================
   EXPORT
============================================================================= */

export default app;
