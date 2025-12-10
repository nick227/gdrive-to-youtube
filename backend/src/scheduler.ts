import cron from 'node-cron';
import prisma from './prismaClient';
import { processUploadJob } from './workers/processUploadJobs';
import { processRenderJob } from './workers/processRenderJobs';
import { syncDrive } from './workers/syncDrive';

// Process upload jobs every minute
cron.schedule('* * * * *', async () => {
  void syncDrive();
});

// Process upload jobs every minute
cron.schedule('* * * * *', async () => {
  console.log('[Scheduler] Checking for pending upload jobs...');
  
  const now = new Date();
  const jobs = await prisma.uploadJob.findMany({
    where: {
      status: 'PENDING',
      OR: [
        { scheduledFor: null },
        { scheduledFor: { lte: now } },
      ],
    },
    include: {
      mediaItem: true,
      youtubeChannel: true,
    },
    take: 5,
  });

  if (jobs.length > 0) {
    console.log(`[Scheduler] Found ${jobs.length} upload job(s) to process`);
    for (const job of jobs) {
      await processUploadJob(job);
    }
  }
});

// Process render jobs every minute
cron.schedule('* * * * *', async () => {
  console.log('[Scheduler] Checking for pending render jobs...');
  
  const jobs = await prisma.renderJob.findMany({
    where: { status: 'PENDING' },
    include: {
      audioMediaItem: true,
      imageMediaItem: true,
    },
    take: 5,
  });

  if (jobs.length > 0) {
    console.log(`[Scheduler] Found ${jobs.length} render job(s) to process`);
    for (const job of jobs) {
      await processRenderJob(job);
    }
  }
});

console.log('[Scheduler] Job scheduler started');
console.log('[Scheduler] - Upload jobs: every minute');
console.log('[Scheduler] - Render jobs: every minute');

export {};

