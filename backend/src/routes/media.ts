// routes/media.ts
import { Router } from 'express';
import prisma from '../prismaClient';
import { requireAuth, getCurrentUser } from '../auth/middleware';

const router = Router();

// List recent media items scoped to drives the current user has linked (shared by rootFolderId)
router.get('/', requireAuth, async (req, res) => {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Connections belonging to this user (non-revoked)
    const connections = await prisma.driveConnection.findMany({
      where: {
        userId: user.id,
        status: { not: 'REVOKED' },
      },
      select: { id: true, rootFolderId: true },
    });

    if (connections.length === 0) {
      return res.json([]);
    }

    const rootFolderIds = Array.from(new Set(connections.map((c) => c.rootFolderId)));

    const media = await prisma.mediaItem.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      where: {
        status: { not: 'MISSING' },
        // shared library: include items whose connection points at any of the same root folders
        driveConnection: {
          rootFolderId: { in: rootFolderIds },
          status: { not: 'REVOKED' },
        },
      },
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
