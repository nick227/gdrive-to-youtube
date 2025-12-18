import os from 'os';
import cron, { ScheduledTask } from 'node-cron';
import prisma from './prismaClient';
import { processUploadJob } from './workers/processUploadJobs';
import { processRenderJob } from './workers/processRenderJobs';
import { syncDrive } from './workers/syncDrive';

// Distributed lease settings
const LEASE_NAME = process.env.SCHEDULER_LEASE_NAME ?? 'default-scheduler';
const INSTANCE_ID = process.env.SCHEDULER_INSTANCE_ID
  ?? `${os.hostname()}-${process.pid}-${Math.random().toString(16).slice(2)}`;
const LEASE_TTL_MS = Number(process.env.SCHEDULER_LEASE_TTL_MS ?? 2 * 60 * 1000); // 2 minutes
const HEARTBEAT_MS = Math.max(Number(process.env.SCHEDULER_HEARTBEAT_MS ?? LEASE_TTL_MS / 2), 10_000);

let tasks: ScheduledTask[] = [];
let running = false;
let leaseHeld = false;
let heartbeatTimer: NodeJS.Timeout | null = null;
let startInFlight: Promise<void> | null = null;
let acceptingWork = false;

const createLeaseTableSql = `
CREATE TABLE IF NOT EXISTS scheduler_leases (
  name VARCHAR(191) NOT NULL PRIMARY KEY,
  holder VARCHAR(191) NOT NULL,
  expires_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB;
`;

const ensureLeaseRow = async () => {
  // Table is created on the fly to avoid a migration dependency for the lease.
  await prisma.$executeRawUnsafe(createLeaseTableSql);
  await prisma.$executeRaw`
    INSERT IGNORE INTO scheduler_leases (name, holder, expires_at, updated_at)
    VALUES (${LEASE_NAME}, '', NOW(6), NOW(6))
  `;
};

const tryAcquireLease = async (): Promise<boolean> => {
  await ensureLeaseRow();

  const expiresAt = new Date(Date.now() + LEASE_TTL_MS);
  const rowsUpdated = await prisma.$executeRaw`
    UPDATE scheduler_leases
    SET holder = ${INSTANCE_ID}, expires_at = ${expiresAt}, updated_at = NOW(6)
    WHERE name = ${LEASE_NAME}
      AND (holder = ${INSTANCE_ID} OR expires_at < NOW(6))
  `;

  leaseHeld = rowsUpdated === 1;
  return leaseHeld;
};

const renewLease = async (): Promise<boolean> => {
  if (!leaseHeld) return false;

  const expiresAt = new Date(Date.now() + LEASE_TTL_MS);
  const rowsUpdated = await prisma.$executeRaw`
    UPDATE scheduler_leases
    SET expires_at = ${expiresAt}, updated_at = NOW(6)
    WHERE name = ${LEASE_NAME} AND holder = ${INSTANCE_ID}
  `;

  leaseHeld = rowsUpdated === 1;
  return leaseHeld;
};

const releaseLease = async (): Promise<void> => {
  if (!leaseHeld) return;

  await prisma.$executeRaw`
    UPDATE scheduler_leases
    SET holder = '', expires_at = NOW(6), updated_at = NOW(6)
    WHERE name = ${LEASE_NAME} AND holder = ${INSTANCE_ID}
  `;

  leaseHeld = false;
};

const startHeartbeat = () => {
  if (heartbeatTimer) clearInterval(heartbeatTimer);

  heartbeatTimer = setInterval(async () => {
    const ok = await renewLease();
    if (!ok) {
      console.warn('[Scheduler] Lost lease; stopping tasks');
      await stopScheduler('lost-lease');
    }
  }, HEARTBEAT_MS);
};

const stopHeartbeat = () => {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
};

const createTasks = (): ScheduledTask[] => ([
  // Drive sync every minute
  cron.schedule('* * * * *', async () => {
    if (!acceptingWork) return;

    try {
      await syncDrive();
    } catch (err) {
      console.error('[Scheduler] Drive sync failed', err);
    }
  }),

  // Process upload jobs every minute
  cron.schedule('* * * * *', async () => {
    if (!acceptingWork) return;

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
  
    if (jobs.length === 0) return;

    console.log(`[Scheduler] Found ${jobs.length} upload job(s) to process`);
    for (const job of jobs) {
      if (!acceptingWork) return;

      try {
        await processUploadJob(job);
      } catch (err) {
        console.error('[Scheduler] Upload job failed', { jobId: job.id, err });
      }
    }
  }),

  // Process render jobs every minute
  cron.schedule('* * * * *', async () => {
    if (!acceptingWork) return;

    console.log('[Scheduler] Checking for pending render jobs...');
    
    const jobs = await prisma.renderJob.findMany({
      where: { status: 'PENDING' },
      include: {
        audioMediaItem: true,
        imageMediaItem: true,
      },
      take: 5,
    });
  
    if (jobs.length === 0) return;

    console.log(`[Scheduler] Found ${jobs.length} render job(s) to process`);
    for (const job of jobs) {
      if (!acceptingWork) return;

      try {
        await processRenderJob(job);
      } catch (err) {
        console.error('[Scheduler] Render job failed', { jobId: job.id, err });
      }
    }
  }),
]);

export const isSchedulerRunning = () => running;

export const startScheduler = async (): Promise<void> => {
  if (running) return;
  if (startInFlight) return startInFlight;

  startInFlight = (async () => {
    const acquired = await tryAcquireLease();
    if (!acquired) {
      console.log(`[Scheduler] Lease '${LEASE_NAME}' held by another instance; not starting here`);
      return;
    }

    acceptingWork = true;
    tasks = createTasks();
    running = true;
    startHeartbeat();

    console.log(`[Scheduler] Started with lease '${LEASE_NAME}' held by ${INSTANCE_ID}`);
    console.log('[Scheduler] - Upload jobs: every minute');
    console.log('[Scheduler] - Render jobs: every minute');
  })().finally(() => {
    startInFlight = null;
  });

  return startInFlight;
};

export const stopScheduler = async (reason = 'manual'): Promise<void> => {
  // Stop future work only; allow in-flight jobs to finish
  acceptingWork = false;

  stopHeartbeat();

  if (tasks.length > 0) {
    for (const task of tasks) {
      task.stop();
    }
    tasks = [];
  }

  running = false;
  await releaseLease();
  console.log(`[Scheduler] Cron stopped (${reason}); in-flight jobs continue`);
};

