import { Router } from 'express';
import prisma from '../prismaClient';
import { getCurrentUser } from '../auth/middleware';

const router = Router();

// Create a new render job
router.post('/', async (req, res) => {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { audioMediaItemId, imageMediaItemId, waveformConfig } = req.body;

    if (!audioMediaItemId) {
      return res.status(400).json({ error: 'audioMediaItemId is required' });
    }

    // Validate audio media exists and is audio/*
    const audioMedia = await prisma.mediaItem.findUnique({
      where: { id: audioMediaItemId },
    });

    if (!audioMedia) {
      return res.status(404).json({ error: 'Audio media item not found' });
    }

    if (!audioMedia.mimeType.startsWith('audio/')) {
      return res.status(400).json({ error: 'audioMediaItemId must reference an audio file' });
    }

    // Validate image media if provided
    if (imageMediaItemId) {
      const imageMedia = await prisma.mediaItem.findUnique({
        where: { id: imageMediaItemId },
      });

      if (!imageMedia) {
        return res.status(404).json({ error: 'Image media item not found' });
      }

      if (!imageMedia.mimeType.startsWith('image/')) {
        return res.status(400).json({ error: 'imageMediaItemId must reference an image file' });
      }
    }

    const renderJob = await prisma.renderJob.create({
      data: {
        audioMediaItemId,
        imageMediaItemId,
        requestedByUserId: user.id,
        waveformConfig: waveformConfig ? JSON.stringify(waveformConfig) : null,
        status: 'PENDING',
      },
      include: {
        audioMediaItem: true,
        imageMediaItem: true,
        requestedByUser: true,
      },
    });

    const serialized = {
      ...renderJob,
      audioMediaItem: {
        ...renderJob.audioMediaItem,
        sizeBytes: renderJob.audioMediaItem.sizeBytes?.toString() ?? null,
      },
      imageMediaItem: renderJob.imageMediaItem ? {
        ...renderJob.imageMediaItem,
        sizeBytes: renderJob.imageMediaItem.sizeBytes?.toString() ?? null,
      } : null,
      requestedByUser: renderJob.requestedByUser
        ? { id: renderJob.requestedByUser.id, email: renderJob.requestedByUser.email, name: renderJob.requestedByUser.name }
        : null,
    };

    res.status(201).json(serialized);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create render job' });
  }
});

// List render jobs
router.get('/', async (req, res) => {
  try {
    const jobs = await prisma.renderJob.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        audioMediaItem: true,
        imageMediaItem: true,
        outputMediaItem: true,
        requestedByUser: true,
      },
    });

    const serialized = jobs.map(job => ({
      ...job,
      audioMediaItem: {
        ...job.audioMediaItem,
        sizeBytes: job.audioMediaItem.sizeBytes?.toString() ?? null,
      },
      imageMediaItem: job.imageMediaItem ? {
        ...job.imageMediaItem,
        sizeBytes: job.imageMediaItem.sizeBytes?.toString() ?? null,
      } : null,
      outputMediaItem: job.outputMediaItem ? {
        ...job.outputMediaItem,
        sizeBytes: job.outputMediaItem.sizeBytes?.toString() ?? null,
      } : null,
      requestedByUser: job.requestedByUser
        ? { id: job.requestedByUser.id, email: job.requestedByUser.email, name: job.requestedByUser.name }
        : null,
    }));

    res.json(serialized);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch render jobs' });
  }
});

export default router;
