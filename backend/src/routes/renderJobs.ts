import { Router } from 'express';
import prisma from '../prismaClient';
import { getCurrentUser } from '../auth/middleware';
import { normalizeIdList, safeParseRenderSpec, RenderSpec } from '../rendering/renderSpec';

const router = Router();

// Create a new render job
router.post('/', async (req, res) => {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // renderSpec is the source of truth. audioMediaItemId / imageMediaItemId remain as legacy inputs for back-compat.
    const { audioMediaItemId, imageMediaItemId, renderSpec } = req.body;

    const { spec, error: renderSpecError } = safeParseRenderSpec(renderSpec);
    if (renderSpec && renderSpecError) {
      return res.status(400).json({ error: renderSpecError });
    }

    const audioIds = normalizeIdList(
      spec?.audios ?? (audioMediaItemId ? [audioMediaItemId] : [])
    );

    if (audioIds.length === 0) {
      return res.status(400).json({ error: 'At least one audioMediaItemId is required' });
    }

    const imageIdsFromSpec =
      spec?.mode === 'slideshow' ? normalizeIdList(spec.images) : [];
    const imageIdsLegacy = normalizeIdList(imageMediaItemId ? [imageMediaItemId] : []);

    const effectiveMode: RenderSpec['mode'] = spec?.mode ?? 'slideshow';
    const imageIds =
      effectiveMode === 'slideshow' ? imageIdsFromSpec.length ? imageIdsFromSpec : imageIdsLegacy : [];

    if (effectiveMode === 'slideshow' && imageIds.length === 0) {
      return res.status(400).json({ error: 'Slideshow renderSpec requires at least one image id' });
    }

    const idsToFetch = [...new Set([...audioIds, ...imageIds])];
    const mediaItems = await prisma.mediaItem.findMany({
      where: { id: { in: idsToFetch } },
    });
    const mediaMap = new Map(mediaItems.map((item) => [item.id, item]));

    for (const id of audioIds) {
      const item = mediaMap.get(id);
      if (!item) {
        return res.status(404).json({ error: `Audio media item ${id} not found` });
      }
      if (!item.mimeType.startsWith('audio/')) {
        return res.status(400).json({ error: `Media item ${id} must be audio/*` });
      }
    }

    for (const id of imageIds) {
      const item = mediaMap.get(id);
      if (!item) {
        return res.status(404).json({ error: `Image media item ${id} not found` });
      }
      if (!item.mimeType.startsWith('image/')) {
        return res.status(400).json({ error: `Media item ${id} must be image/*` });
      }
    }

    const primaryAudioId = audioIds[0];
    const primaryImageId = imageIds.length > 0 ? imageIds[0] : null;

    const specToStore: RenderSpec =
      spec ??
      {
        mode: 'slideshow',
        images: imageIds,
        audios: audioIds,
        intervalSeconds: 5,
        autoTime: true,
        repeatImages: false,
      };

    const renderJob = await prisma.renderJob.create({
      data: {
        audioMediaItemId: primaryAudioId,
        imageMediaItemId: primaryImageId,
        renderSpec: JSON.stringify(specToStore),
        requestedByUserId: user.id,
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

    console.log('[render-jobs] returning', serialized.length, 'jobs');
    res.json(serialized);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch render jobs' });
  }
});

export default router;
