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

const router = Router();
let runnerActive = false;

const normalizeTasks = (tasks: unknown): TaskType[] => {
  if (!Array.isArray(tasks) || tasks.length === 0) return [...VALID_TASKS];
  const filtered = tasks
    .map(t => (typeof t === 'string' ? t.toLowerCase().trim() : ''))
    .filter(t => VALID_TASKS.includes(t as TaskType)) as TaskType[];
  const deduped = Array.from(new Set(filtered));
  return deduped.length === 0 ? [...VALID_TASKS] : deduped;
};

const claimUploadJobs = async (): Promise<UploadJobWithRelations[]> => {
  const candidates = await prisma.uploadJob.findMany({
    where: { status: 'PENDING' as JobStatus },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
    take: MAX_UPLOAD_JOBS,
  });
  const ids = candidates.map(c => c.id);
  if (ids.length === 0) return [];

  const updated = await prisma.uploadJob.updateMany({
    where: { id: { in: ids }, status: 'PENDING' as JobStatus },
    data: { status: 'RUNNING' as JobStatus, errorMessage: null },
  });
  if (updated.count === 0) return [];

  return prisma.uploadJob.findMany({
    where: { id: { in: ids }, status: 'RUNNING' as JobStatus },
    include: {
      mediaItem: true,
      youtubeChannel: true,
      thumbnailMediaItem: true,
    },
  });
};

const claimRenderJobs = async (): Promise<RenderJobWithRelations[]> => {
  const candidates = await prisma.renderJob.findMany({
    where: { status: 'PENDING' as JobStatus },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
    take: MAX_RENDER_JOBS,
  });
  const ids = candidates.map(c => c.id);
  if (ids.length === 0) return [];

  const updated = await prisma.renderJob.updateMany({
    where: { id: { in: ids }, status: 'PENDING' as JobStatus },
    data: { status: 'RUNNING' as JobStatus, errorMessage: null },
  });
  if (updated.count === 0) return [];

  return prisma.renderJob.findMany({
    where: { id: { in: ids }, status: 'RUNNING' as JobStatus },
    include: {
      audioMediaItem: true,
      imageMediaItem: true,
    },
  });
};

const runUploads = async () => {
  const jobs = await claimUploadJobs();
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


const runRenders = async () => {
  const jobs = await claimRenderJobs();
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

  if (runnerActive) {
    return res.status(202).json({
      ok: true,
      queued: false,
      message: 'Runner already active; ignoring duplicate trigger',
    });
  }

  const tasks = normalizeTasks(req.body?.tasks);

  runnerActive = true;
  try {
    void Promise.allSettled([
      tasks.includes('sync') ? syncDrive() : Promise.resolve(null),
      tasks.includes('uploads') ? runUploads() : Promise.resolve(null),
      tasks.includes('renders') ? runRenders() : Promise.resolve(null),
    ]).finally(() => {
      runnerActive = false;
    });
  } catch (err) {
    runnerActive = false;
    console.error('[jobQueue] trigger failed before dispatch', err);
    return res.status(500).json({ error: 'Failed to dispatch jobs' });
  }

  return res.status(202).json({
    ok: true,
    tasks,
    queued: true,
    message: 'Jobs triggered; processing in background',
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
    prisma.uploadJob.count({ where: { status: 'PENDING' } }),
    prisma.uploadJob.count({ where: { status: 'RUNNING' } }),
    prisma.uploadJob.count({ where: { status: 'SUCCESS' } }),
    prisma.renderJob.count({ where: { status: 'PENDING' } }),
    prisma.renderJob.count({ where: { status: 'RUNNING' } }),
    prisma.renderJob.count({ where: { status: 'SUCCESS' } }),
  ]);

  return res.json({
    uploads: { pending: pendingUploads, running: runningUploads, success: successUploads },
    renders: { pending: pendingRenders, running: runningRenders, success: successRenders },
  });
});

export default router;
