// routes/media.ts
import { Router } from 'express';
import prisma from '../prismaClient';
import { requireAuth } from '../auth/middleware';

const router = Router();

// List recent media items scoped to any active Drive connection (shared by rootFolderId)
router.get('/', requireAuth, async (req, res) => {
  try {
    console.log('[media] request from user', req.user ? (req.user as { id?: number; email?: string }).email : 'unknown');

    // All active/non-revoked drive connections (shared library)
    const connections = await prisma.driveConnection.findMany({
      where: { status: { not: 'REVOKED' } },
      select: { rootFolderId: true },
    });

    if (connections.length === 0) {
      return res.json([]);
    }

    const rootFolderIds = Array.from(new Set(connections.map((c) => c.rootFolderId)));

    console.log('[media] active connections', connections.length, rootFolderIds);

    const media = await prisma.mediaItem.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      where: {
        status: { not: 'MISSING' },
        // shared library: include items whose connection points at any active root folders
        driveConnection: {
          rootFolderId: { in: rootFolderIds },
          status: { not: 'REVOKED' },
        },
      },
    });

    console.log('[media] returning media count', media.length);

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
