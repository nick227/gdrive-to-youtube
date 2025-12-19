  import app from './app';
  import prisma from './prismaClient';
  import { isSchedulerRunning, startScheduler, stopScheduler } from './scheduler';

  const SHOULD_RUN_SCHEDULER = process.env.NODE_ENV === 'production' && process.env.ENABLE_SCHEDULER === 'true';
  const INACTIVITY_MS = Number(process.env.SCHEDULER_INACTIVITY_MS ?? 5 * 60 * 1000); // 5 minutes
  let idleTimer: NodeJS.Timeout | null = null;

const port = process.env.SERVER_PORT || process.env.PORT || 4000;

const server = app.listen(port, () => {
  console.log(`Backend listening on port ${port}`);

  // Kick the scheduler once on boot so media sync starts even before traffic arrives.
  if (SHOULD_RUN_SCHEDULER && !isSchedulerRunning()) {
    void startScheduler();
  }
});

const API_ACTIVITY_PREFIXES = [
  '/auth',
  '/media',
  '/videos',
  '/channels',
  '/media-preview',
  '/drive',
  '/upload-jobs',
  '/render-jobs',
];

const shouldCountForActivity = (req: { path?: string; method?: string }): boolean => {
  const path = req.path || '';
  if (req.method === 'OPTIONS') return false;

  // Ignore static/Next assets and service worker probes
  if (
    path.startsWith('/_next') ||
    path.startsWith('/static') ||
    path.startsWith('/favicon') ||
    path.startsWith('/workbox') ||
    path.startsWith('/dev-sw') ||
    path.endsWith('.js') ||
    path.endsWith('.css') ||
    path.endsWith('.svg')
  ) {
    return false;
  }

  return API_ACTIVITY_PREFIXES.some(prefix => path.startsWith(prefix));
};

  const touchSchedulerActivity = () => {
    if (!SHOULD_RUN_SCHEDULER) return;

    if (!isSchedulerRunning()) {
      void startScheduler();
    }

    if (idleTimer) {
      clearTimeout(idleTimer);
    }

    idleTimer = setTimeout(() => {
      void stopScheduler('inactivity');
    }, INACTIVITY_MS);
  };

// Track traffic and drive scheduler lifecycle (ignore static noise)
if (SHOULD_RUN_SCHEDULER) {
  app.use((req, _res, next) => {
    if (shouldCountForActivity(req)) {
      touchSchedulerActivity();
    }
    next();
  });
}

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`${signal} received, shutting down gracefully...`);
    
    if (SHOULD_RUN_SCHEDULER) {
      await stopScheduler('shutdown');
    }

    server.close(() => {
      console.log('HTTP server closed');
      
      prisma.$disconnect()
        .then(() => {
          console.log('Database connection closed');
          process.exit(0);
        })
        .catch((err) => {
          console.error('Error closing database connection:', err);
          process.exit(1);
        });
    });

    // Force shutdown after 10 seconds
    setTimeout(() => {
      console.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Handle uncaught exceptions
  process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    void shutdown('uncaughtException');
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Don't exit - log and continue
  });
