import express, { Request, Response, NextFunction } from 'express';
import session from 'express-session';
import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';
import passport from './auth/passport';
import { requireAuth } from './auth/middleware';
import authRoutes from './routes/auth';
import mediaRoutes from './routes/media';
import uploadJobRoutes from './routes/uploadJobs';
import renderJobRoutes from './routes/renderJobs';
import youtubeVideoRoutes from './routes/youtubeVideos';
import youtubeChannelRoutes from './routes/youtubeChannels';
import mediaRouter from './routes/media-preview';
import prisma from './prismaClient';
import { validateEnv } from './config/validateEnv';

dotenv.config();
validateEnv();

const app = express();

/* -----------------------------
   1. Auto-trust the CURRENT origin
----------------------------- */
app.use((req, res, next) => {
  const origin = req.headers.origin;

  // Allow everything in dev
  if (process.env.NODE_ENV !== 'production') {
    res.setHeader("Access-Control-Allow-Origin", origin || "*");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
    if (req.method === "OPTIONS") return res.sendStatus(200);
    return next();
  }

  // Production: Trust ONLY the deployed frontend
  const prodOrigin = process.env.FRONTEND_URL?.replace(/\/$/, "");

  if (origin === prodOrigin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }

  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");

  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

app.use(express.json({ limit: '10mb' }));

/* -----------------------------
   2. Sessions
----------------------------- */
app.use(
  session({
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    }
  })
);

/* -----------------------------
   3. Passport
----------------------------- */
app.use(passport.initialize());
app.use(passport.session());

/* -----------------------------
   4. API ROUTES (MUST BE ABOVE STATIC FRONTEND)
----------------------------- */
app.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true });
  } catch (_) {
    res.status(503).json({ ok: false });
  }
});

app.use('/auth', authRoutes);
app.use('/media', mediaRoutes);
app.use('/videos', youtubeVideoRoutes);
app.use('/channels', youtubeChannelRoutes);
app.use('/media-preview', mediaRouter);
app.use('/upload-jobs', requireAuth, uploadJobRoutes);
app.use('/render-jobs', requireAuth, renderJobRoutes);

/* -----------------------------
   5. Static Frontend (PRODUCTION ONLY)
----------------------------- */
if (process.env.NODE_ENV === 'production') {
  const frontendDir = path.resolve(__dirname, '../public');
  console.log("Static frontend expected at:", frontendDir);

  if (fs.existsSync(frontendDir)) {
    app.use(express.static(frontendDir));

    const API_PREFIXES = [
      '/auth', '/media', '/videos', '/channels', '/media-preview',
      '/upload-jobs', '/render-jobs', '/health'
    ];

    // Catch-all for frontend routing
    app.get('*', (req, res, next) => {
      // If an API route → skip catch-all
      if (API_PREFIXES.some(p => req.path.startsWith(p))) {
        return next();
      }

      res.sendFile(path.join(frontendDir, 'index.html'), err => {
        if (err) next(err);
      });
    });
  }
}

/* -----------------------------
   6. Global Error Handler
----------------------------- */
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled error:', err);

  res.status(500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message,
  });
});

export default app;
