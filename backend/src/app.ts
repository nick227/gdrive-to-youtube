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

// CORS
app.use((req, res, next) => {
  const origin = req.headers.origin;
const allowedOrigins = [
  process.env.FRONTEND_URL,
  process.env.BACKEND_URL,
  'http://localhost:3000'
].filter(Boolean);


  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json({ limit: '10mb' }));

// Session configuration
const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  throw new Error('SESSION_SECRET must be set in environment');
}
app.use(
  session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    },
  })
);

// Passport initialization
app.use(passport.initialize());
app.use(passport.session());

// Health check (public)
app.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, database: 'connected' });
  } catch (err) {
    res.status(503).json({ ok: false, database: 'disconnected', error: 'Database connection failed: ' + err });
  }
});

// Auth routes (public)
app.use('/auth', authRoutes);

// Public routes (read-only)
app.use('/media', mediaRoutes);
app.use('/videos', youtubeVideoRoutes);
app.use('/channels', youtubeChannelRoutes);
app.use('/media-preview', mediaRouter);
// Protected routes (require authentication)
app.use('/upload-jobs', requireAuth, uploadJobRoutes);
app.use('/render-jobs', requireAuth, renderJobRoutes);

// Serve exported Next.js frontend (static) only in production
if (process.env.NODE_ENV === 'production') {
  // From dist/src → go to dist/public
  const frontendDir = path.resolve(__dirname, '../public');

  console.log("Static frontend expected at:", frontendDir);

  if (fs.existsSync(frontendDir)) {
    app.use(express.static(frontendDir));

    // Catch-all: return index.html for non-API routes
    app.get('*', (req, res, next) => {
      const apiPaths = [
        '/auth', '/media', '/videos',
        '/channels', '/media-preview',
        '/upload-jobs', '/render-jobs', '/health'
      ];

      if (apiPaths.some(p => req.path.startsWith(p))) {
        return next();
      }

      res.sendFile(path.join(frontendDir, 'index.html'), err => {
        if (err) next(err);
      });
    });
  } else {
    console.warn('Static frontend folder NOT found:', frontendDir);
  }
}

// Global error handler (must be last)
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', {
    error: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    path: req?.path,
    method: req?.method,
  });
  
  if (typeof res?.status === 'function') {
    res.status(500).json({
      error: process.env.NODE_ENV === 'production' 
        ? 'Internal server error' 
        : err.message,
    });
  } else {
    // Fall back in case this is invoked outside a normal request/response cycle
    console.error('Response object missing in error handler; cannot send HTTP response');
  }
});

export default app;
