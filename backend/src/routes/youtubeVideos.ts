import { Router } from 'express';
import prisma from '../prismaClient';

const router = Router();

// List YouTube videos known by the system
router.get('/', async (req, res) => {
  try {
    const videos = await prisma.youtubeVideo.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        mediaItem: true,
        youtubeChannel: true,
      },
    });
    
    const serializedVideos = videos.map(video => ({
      ...video,
      mediaItem: video.mediaItem ? {
        ...video.mediaItem,
        sizeBytes: video.mediaItem.sizeBytes ? video.mediaItem.sizeBytes.toString() : null,
      } : null,
    }));
    
    res.json(serializedVideos);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch videos' });
  }
});

export default router;
