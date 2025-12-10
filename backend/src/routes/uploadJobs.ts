import { Router } from 'express';
import prisma from '../prismaClient';
import { PrivacyStatus } from '@prisma/client';
import { getCurrentUser } from '../auth/middleware';

const router = Router();

// Create a new upload job
router.post('/', async (req, res) => {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const {
      mediaItemId,
      youtubeChannelId,
      title,
      description,
      tags,
      privacyStatus,
      scheduledFor,
    } = req.body;

    if (!mediaItemId || !youtubeChannelId || !title || !description || !privacyStatus) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!Object.values(PrivacyStatus).includes(privacyStatus)) {
      return res.status(400).json({ error: 'Invalid privacyStatus' });
    }

    const job = await prisma.uploadJob.create({
      data: {
        mediaItemId,
        youtubeChannelId,
        requestedByUserId: user.id,
        title,
        description,
        tags: tags ? JSON.stringify(tags) : null,
        privacyStatus,
        scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
      },
    });

    res.status(201).json(job);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create upload job' });
  }
});

// List recent upload jobs
router.get('/', async (req, res) => {
  try {
    const user = getCurrentUser(req);
    
    // Filter by user if authenticated
    const whereClause = user ? { requestedByUserId: user.id } : {};
    
    const jobs = await prisma.uploadJob.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        mediaItem: true,
        youtubeChannel: true,
      },
    });
    
    const serializedJobs = jobs.map(job => ({
      ...job,
      mediaItem: job.mediaItem ? {
        ...job.mediaItem,
        sizeBytes: job.mediaItem.sizeBytes ? job.mediaItem.sizeBytes.toString() : null,
      } : null,
    }));
    
    res.json(serializedJobs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch upload jobs' });
  }
});

// Cancel/delete a pending upload job
router.delete('/:id', async (req, res) => {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const jobId = parseInt(req.params.id, 10);
    if (isNaN(jobId)) {
      return res.status(400).json({ error: 'Invalid job ID' });
    }

    const job = await prisma.uploadJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Only allow owner to cancel
    if (job.requestedByUserId !== user.id) {
      return res.status(403).json({ error: 'Not authorized to cancel this job' });
    }

    // Only allow canceling PENDING jobs
    if (job.status !== 'PENDING') {
      return res.status(400).json({ error: `Cannot cancel job with status ${job.status}` });
    }

    await prisma.uploadJob.delete({
      where: { id: jobId },
    });

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to cancel upload job' });
  }
});

export default router;
