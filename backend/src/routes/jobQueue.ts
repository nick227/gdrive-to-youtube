import { Router } from 'express';
import prisma from '../prismaClient';
import { getCurrentUser } from '../auth/middleware';
import { syncDrive } from '../workers/syncDrive';
import { processUploadJob, type UploadJobWithRelations } from '../workers/processUploadJobs';
import { processRenderJob } from '../workers/processRenderJobs';
import type { JobStatus } from '@prisma/client';
import type { RenderJobWithRelations } from '../rendering/mediaResolver';

type TaskType = 'sync' | 'uploads' | 'renders';

const MAX_UPLOAD_JOBS = 5;
const MAX_RENDER_JOBS = 5;
const VALID_TASKS: TaskType[] = ['sync', 'uploads', 'renders'];
const DEFAULT_TASKS: TaskType[] = ['uploads', 'renders']; // avoid implicit Drive sync
const TRIGGER_COOLDOWN_MS = 3000;

const router = Router();
const activeRunners = new Set<number>();
const lastTriggerAt = new Map<number, number>();

const normalizeTasks = (tasks: unknown): TaskType[] => {
  if (!Array.isArray(tasks) || tasks.length === 0) return [...DEFAULT_TASKS];
  const filtered = tasks
    .map(t => (typeof t === 'string' ? t.toLowerCase().trim() : ''))
    .filter(t => VALID_TASKS.includes(t as TaskType)) as TaskType[];
  const deduped = Array.from(new Set(filtered));
  return deduped.length === 0 ? [...DEFAULT_TASKS] : deduped;
};

const claimUploadJobs = async (userId: number): Promise<UploadJobWithRelations[]> => {
  const now = new Date();
  const running = await prisma.uploadJob.count({
    where: { status: 'RUNNING' as JobStatus, requestedByUserId: userId },
  });
  if (running >= MAX_UPLOAD_JOBS) return [];
  const slots = Math.max(0, MAX_UPLOAD_JOBS - running);
  if (slots === 0) return [];

  const candidates = await prisma.uploadJob.findMany({
    where: {
      status: 'PENDING' as JobStatus,
      requestedByUserId: userId,
      OR: [{ scheduledFor: null }, { scheduledFor: { lte: now } }],
    },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
    take: slots,
  });
  const ids = candidates.map(c => c.id);
  if (ids.length === 0) return [];

  const updated = await prisma.uploadJob.updateMany({
    where: {
      id: { in: ids },
      status: 'PENDING' as JobStatus,
      requestedByUserId: userId,
      OR: [{ scheduledFor: null }, { scheduledFor: { lte: now } }],
    },
    data: { status: 'RUNNING' as JobStatus, errorMessage: null },
  });
  if (updated.count === 0) return [];

  return prisma.uploadJob.findMany({
    where: { id: { in: ids }, status: 'RUNNING' as JobStatus, requestedByUserId: userId },
    include: {
      mediaItem: true,
      youtubeChannel: true,
      thumbnailMediaItem: true,
    },
  });
};

const claimRenderJobs = async (userId: number): Promise<RenderJobWithRelations[]> => {
  const now = new Date();
  const running = await prisma.renderJob.count({
    where: { status: 'RUNNING' as JobStatus, requestedByUserId: userId },
  });
  if (running >= MAX_RENDER_JOBS) return [];
  const slots = Math.max(0, MAX_RENDER_JOBS - running);
  if (slots === 0) return [];

  const candidates = await prisma.renderJob.findMany({
    where: {
      status: 'PENDING' as JobStatus,
      requestedByUserId: userId,
      OR: [{ scheduledFor: null }, { scheduledFor: { lte: now } }],
    },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
    take: slots,
  });
  const ids = candidates.map(c => c.id);
  if (ids.length === 0) return [];

  const updated = await prisma.renderJob.updateMany({
    where: {
      id: { in: ids },
      status: 'PENDING' as JobStatus,
      requestedByUserId: userId,
      OR: [{ scheduledFor: null }, { scheduledFor: { lte: now } }],
    },
    data: { status: 'RUNNING' as JobStatus, errorMessage: null },
  });
  if (updated.count === 0) return [];

  return prisma.renderJob.findMany({
    where: { id: { in: ids }, status: 'RUNNING' as JobStatus, requestedByUserId: userId },
    include: {
      audioMediaItem: true,
      imageMediaItem: true,
    },
  });
};

const runUploads = async (userId: number) => {
  const jobs = await claimUploadJobs(userId);
  let processed = 0;

  for (const job of jobs) {
    try {
      await processUploadJob(job);

      await prisma.uploadJob.update({
        where: { id: job.id },
        data: { status: 'SUCCESS' as JobStatus, errorMessage: null },
      });

      processed++;
    } catch (err) {
      await prisma.uploadJob.update({
        where: { id: job.id },
        data: {
          status: 'FAILED' as JobStatus,
          errorMessage: String(err),
        },
      }).catch(() => {});

      console.error('[jobQueue] Upload job failed', { jobId: job.id, err });
    }
  }

  return { processed, scanned: jobs.length };
};


const runRenders = async (userId: number) => {
  const jobs = await claimRenderJobs(userId);
  let processed = 0;
  for (const job of jobs) {
    try {
      await processRenderJob(job);
      await prisma.renderJob.update({
        where: { id: job.id },
        data: { status: 'SUCCESS' as JobStatus, errorMessage: null },
      });
      processed += 1;
    } catch (err) {
      await prisma.renderJob.update({
        where: { id: job.id },
        data: {
          status: 'FAILED' as JobStatus,
          errorMessage: String(err),
        },
      }).catch(() => {});
      console.error('[jobQueue] Render job failed', { jobId: job.id, err });
    }
  }
  return { processed, scanned: jobs.length };
};

router.post('/trigger', async (req, res) => {
  const user = getCurrentUser(req);
  if (!user) return res.status(401).json({ error: 'Authentication required' });

  const nowTs = Date.now();
  const last = lastTriggerAt.get(user.id);
  if (last && nowTs - last < TRIGGER_COOLDOWN_MS) {
    return res.status(429).json({
      error: 'Too many trigger requests; please wait a moment',
      retryAfterMs: TRIGGER_COOLDOWN_MS - (nowTs - last),
    });
  }

  const tasks = normalizeTasks(req.body?.tasks);

  const now = new Date();
  const activeConnections = tasks.includes('sync')
    ? await prisma.driveConnection.count({
      where: { userId: user.id, status: 'ACTIVE' },
    })
    : 0;

  const uploadsDue = tasks.includes('uploads')
    ? await prisma.uploadJob.count({
      where: {
        status: 'PENDING',
        requestedByUserId: user.id,
        OR: [{ scheduledFor: null }, { scheduledFor: { lte: now } }],
      },
    })
    : 0;
  const rendersDue = tasks.includes('renders')
    ? await prisma.renderJob.count({
      where: {
        status: 'PENDING',
        requestedByUserId: user.id,
        OR: [{ scheduledFor: null }, { scheduledFor: { lte: now } }],
      },
    })
    : 0;
  const syncRequested = tasks.includes('sync');
  const shouldSync = syncRequested && activeConnections > 0;
  const hasWork = shouldSync || uploadsDue > 0 || rendersDue > 0;

  if (!hasWork) {
    return res.status(200).json({
      ok: true,
      queued: false,
      tasks,
      uploadsDue,
      rendersDue,
      activeConnections,
      message: 'No due jobs for this user; skipping dispatch',
    });
  }

  const alreadyActive = activeRunners.has(user.id);
  lastTriggerAt.set(user.id, nowTs);
  activeRunners.add(user.id);
  try {
    void Promise.allSettled([
      shouldSync ? syncDrive({ userId: user.id }) : Promise.resolve(null),
      tasks.includes('uploads') ? runUploads(user.id) : Promise.resolve(null),
      tasks.includes('renders') ? runRenders(user.id) : Promise.resolve(null),
    ]).finally(() => {
      activeRunners.delete(user.id);
    });
  } catch (err) {
    activeRunners.delete(user.id);
    console.error('[jobQueue] trigger failed before dispatch', err);
    return res.status(500).json({ error: 'Failed to dispatch jobs' });
  }

  return res.status(202).json({
    ok: true,
    tasks,
    queued: true,
    message: alreadyActive
      ? 'Jobs triggered; runner already active (best-effort)'
      : 'Jobs triggered; processing in background',
    uploadsDue,
    rendersDue,
  });
});

router.get('/status', async (req, res) => {
  const user = getCurrentUser(req);
  if (!user) return res.status(401).json({ error: 'Authentication required' });

  const [
    pendingUploads,
    runningUploads,
    successUploads,
    pendingRenders,
    runningRenders,
    successRenders,
  ] = await Promise.all([
    prisma.uploadJob.count({ where: { status: 'PENDING', requestedByUserId: user.id } }),
    prisma.uploadJob.count({ where: { status: 'RUNNING', requestedByUserId: user.id } }),
    prisma.uploadJob.count({ where: { status: 'SUCCESS', requestedByUserId: user.id } }),
    prisma.renderJob.count({ where: { status: 'PENDING', requestedByUserId: user.id } }),
    prisma.renderJob.count({ where: { status: 'RUNNING', requestedByUserId: user.id } }),
    prisma.renderJob.count({ where: { status: 'SUCCESS', requestedByUserId: user.id } }),
  ]);

  return res.json({
    uploads: { pending: pendingUploads, running: runningUploads, success: successUploads },
    renders: { pending: pendingRenders, running: runningRenders, success: successRenders },
  });
});

export default router;
