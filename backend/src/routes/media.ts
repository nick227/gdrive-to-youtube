// routes/media.ts
import { Router } from 'express';
import prisma from '../prismaClient';

const router = Router();

// List recent media items
router.get('/', async (req, res) => {
  try {
    const media = await prisma.mediaItem.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      where: {
        status: { not: 'MISSING' }
      }
    });

    const serializedMedia = media.map(item => ({
      ...item,
      sizeBytes: item.sizeBytes ? item.sizeBytes.toString() : null,
    }));

    res.json(serializedMedia);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch media items' });
  }
});

export default router;
