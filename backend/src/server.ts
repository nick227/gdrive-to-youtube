import app from './app';
import prisma from './prismaClient';

// Start scheduler in production
if (process.env.NODE_ENV === 'production') {
  import('./scheduler')
    .then(() => {
      console.log('[Scheduler] Started successfully');
    })
    .catch((err) => {
      console.error('[Scheduler] CRITICAL: Failed to start:', err);
      // Don't exit - allow server to start even if scheduler fails
      // But log it prominently for monitoring
    });
}

const port = process.env.SERVER_PORT || process.env.PORT || 4000;

const server = app.listen(port, () => {
  console.log(`Backend listening on port ${port}`);
});

// Graceful shutdown
const shutdown = async (signal: string) => {
  console.log(`${signal} received, shutting down gracefully...`);
  
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

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit - log and continue
});
