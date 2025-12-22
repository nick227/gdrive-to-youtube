// src/workers/syncDrive.ts
import dotenv from 'dotenv';
import { drive_v3 } from 'googleapis';
import prisma from '../prismaClient';
import { DriveConnectionStatus } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { refreshConnectionIfNeeded, markDriveConnectionStatus } from '../utils/driveConnectionClient';

dotenv.config();

const PAGE_SIZE = 100;
const DEFAULT_MIME_TYPE = 'application/octet-stream';
const folderPathCache = new Map<string, string>();
const connectionLocks = new Set<string>();
const lastSyncAt = new Map<string, number>();

// Tunables
const MIN_SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_FILES_PER_CONNECTION = 5000;
const UPSERT_CONCURRENCY = 5;

interface SyncStats {
  upserted: number;
  markedMissing: number;
}

interface SyncDriveOptions {
  userId?: number;
  driveConnectionIds?: string[];
}

/**
 * Recursively fetches all files under a root Drive folder (including nested folders)
 */
async function fetchAllDescendantFiles(
  drive: drive_v3.Drive,
  rootFolderId: string,
  maxFiles?: number
): Promise<{ files: drive_v3.Schema$File[]; truncated: boolean }> {
  const allFiles: drive_v3.Schema$File[] = [];
  const folderQueue: string[] = [rootFolderId];
  let truncated = false;

  while (folderQueue.length > 0) {
    const currentFolderId = folderQueue.shift()!;
    let pageToken: string | undefined;

    do {
      const response = await drive.files.list({
        q: `'${currentFolderId}' in parents and trashed = false`,
        fields:
          'nextPageToken, files(id, name, mimeType, size, modifiedTime, webViewLink, webContentLink, parents)',
        pageSize: PAGE_SIZE,
        pageToken,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });

      const files = response.data.files || [];

      for (const file of files) {
        if (!file.id) continue;

        // If this is a folder, enqueue it and continue
        if (file.mimeType === 'application/vnd.google-apps.folder') {
          folderQueue.push(file.id);
        } else {
          allFiles.push(file);
        }

        if (maxFiles && allFiles.length >= maxFiles) {
          truncated = true;
          folderQueue.length = 0;
          break;
        }
      }

      pageToken = response.data.nextPageToken || undefined;
    } while (pageToken);
  }

  return { files: allFiles, truncated };
}

/**
 * Resolve a Drive folder's path from the configured root, e.g. "/Parent/Subfolder"
 */
async function getFolderPath(
  drive: drive_v3.Drive,
  folderId: string | null | undefined,
  rootFolderId: string
): Promise<string | null> {
  if (!folderId) return null;

  // Cached?
  if (folderPathCache.has(folderId)) {
    return folderPathCache.get(folderId)!;
  }

  const segments: string[] = [];
  let currentId: string | null | undefined = folderId;

  // Walk up until we hit the configured root or run out of parents
  while (currentId && currentId !== rootFolderId) {
    // If we hit a folder whose path we already know, reuse it
    if (folderPathCache.has(currentId)) {
      const cached = folderPathCache.get(currentId)!; // "/A/B"
      const cachedSegments = cached.replace(/^\//, '').split('/');
      segments.push(...cachedSegments.reverse());
      break;
    }

    const res = await drive.files.get({
      fileId: currentId,
      fields: 'id, name, parents',
      supportsAllDrives: true,
    });

    const folder = res.data as drive_v3.Schema$File;
    if (!folder || !folder.name) break;

    segments.push(folder.name);
    currentId =
      folder.parents && folder.parents.length > 0
        ? folder.parents[0]
        : null;
  }

  if (segments.length === 0) {
    folderPathCache.set(folderId, '/');
    return '/';
  }

  const pathStr = '/' + segments.reverse().join('/');
  folderPathCache.set(folderId, pathStr);
  return pathStr;
}

/**
 * Upserts a single file to the database
 */
async function upsertFile(
  file: drive_v3.Schema$File,
  folderPath: string | null,
  driveConnectionId: string
): Promise<void> {
  if (!file.id) return;

  const fileData = {
    name: file.name || 'unnamed',
    mimeType: file.mimeType || DEFAULT_MIME_TYPE,
    sizeBytes: file.size ? BigInt(file.size) : null,
    folderId: file.parents?.[0] || null,
    folderPath,
    webViewLink: file.webViewLink || null,
    webContentLink: file.webContentLink || null,
    driveConnectionId,
    status: 'ACTIVE' as const,
  };

  await prisma.mediaItem.upsert({
    where: { driveFileId: file.id },
    create: {
      driveFileId: file.id,
      ...fileData,
    },
    update: fileData,
  });
}

/**
 * Marks files as MISSING if they weren't seen in this sync
 * (i.e. they no longer exist under the synced Drive root).
 *
 * We only touch rows that:
 * - are currently ACTIVE
 * - have a non-null folderPath (i.e. created by this sync)
 * - have driveFileId not in the latest seenIds
 */
async function markMissingFiles(seenIds: Set<string>, driveConnectionId: string): Promise<number> {
  // Defensive: if Drive returned nothing, don't nuke everything.
  if (seenIds.size === 0) {
    console.warn(
      '[syncDrive] No files seen from Drive; skipping markMissingFiles to avoid marking everything MISSING.'
    );
    return 0;
  }

  const seenIdsArray = Array.from(seenIds);

  const result = await prisma.mediaItem.updateMany({
    where: {
      status: 'ACTIVE',
      folderPath: { not: null },      // only items managed by this sync
      driveConnectionId,
      driveFileId: { notIn: seenIdsArray },
    },
    data: {
      status: 'MISSING',
    },
  });

  return result.count;
}

async function processWithConcurrency<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>
): Promise<void> {
  let index = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const current = items[index++];
      await fn(current);
    }
  });
  await Promise.all(workers);
}


/**
 * Syncs files from Google Drive to the database
 */
export async function syncDrive(options: SyncDriveOptions = {}): Promise<SyncStats> {
  const where: Prisma.DriveConnectionWhereInput = {
    status: DriveConnectionStatus.ACTIVE,
  };

  if (options.userId) {
    where.userId = options.userId;
  }

  if (options.driveConnectionIds?.length) {
    const uniqueIds = Array.from(new Set(options.driveConnectionIds));
    where.id = { in: uniqueIds };
  }

  const connections = await prisma.driveConnection.findMany({
    where,
  });

  if (connections.length === 0) {
    return { upserted: 0, markedMissing: 0 };
  }

  let totalUpserted = 0;
  let totalMissing = 0;

  try {
    for (const connection of connections) {
      const lockKey = connection.id;
      const last = lastSyncAt.get(lockKey);
      const nowTs = Date.now();
      if (last && nowTs - last < MIN_SYNC_INTERVAL_MS) {
        console.log('[syncDrive] skipping due to throttle', { connectionId: connection.id });
        continue;
      }
      if (connectionLocks.has(lockKey)) {
        console.log('[syncDrive] skipping because a sync is already running', { connectionId: connection.id });
        continue;
      }

      connectionLocks.add(lockKey);
      lastSyncAt.set(lockKey, nowTs);
      console.log('[syncDrive] start', { connectionId: connection.id, root: connection.rootFolderId });
      const seenIds = new Set<string>();
      const folderCacheForConnection = new Map<string, string>();

      try {
        const existingActive = await prisma.mediaItem.count({
          where: { driveConnectionId: connection.id, status: 'ACTIVE' },
        });

        const { drive } = await refreshConnectionIfNeeded(connection);

        // reset shared cache per connection
        folderPathCache.clear();
        for (const [k, v] of folderCacheForConnection.entries()) {
          folderPathCache.set(k, v);
        }

        const { files, truncated } = await fetchAllDescendantFiles(
          drive,
          connection.rootFolderId,
          MAX_FILES_PER_CONNECTION
        );
        console.log('[syncDrive] fetched files', {
          connectionId: connection.id,
          count: files.length,
          truncated,
        });

        if (files.length === 0) {
          console.warn('[syncDrive] WARNING: zero files returned from Drive', { connectionId: connection.id });
        } else if (files.length < 3 && existingActive > 0) {
          console.warn('[syncDrive] WARNING: unusually low file count vs existing records', {
            connectionId: connection.id,
            fetched: files.length,
            existingActive,
          });
        }

        await processWithConcurrency(files, UPSERT_CONCURRENCY, async (file) => {
          if (!file.id) return;

          seenIds.add(file.id);

          const parentId = file.parents?.[0] ?? null;
          const folderPath = await getFolderPath(drive, parentId, connection.rootFolderId);

          if (folderPath) {
            folderCacheForConnection.set(parentId ?? '', folderPath);
          }

          await upsertFile(file, folderPath, connection.id);
        });

        const markedMissing = truncated ? 0 : await markMissingFiles(seenIds, connection.id);
        totalUpserted += seenIds.size;
        totalMissing += markedMissing;
        console.log('[syncDrive] complete', {
          connectionId: connection.id,
          upserted: seenIds.size,
          markedMissing,
          truncated,
        });
      } catch (err) {
        console.error(`[syncDrive] error for connection ${connection.id}:`, err);
        await markDriveConnectionStatus(
          connection.id,
          DriveConnectionStatus.ERROR,
          String(err)
        );
      } finally {
        connectionLocks.delete(lockKey);
      }
    }

    return {
      upserted: totalUpserted,
      markedMissing: totalMissing,
    };
  } catch (error) {
    console.error('Error during Drive sync:', error);
    throw error;
  }
}

// Main execution
if (require.main === module) {
  void syncDrive()
    .then((stats) => {
      console.log('Sync completed successfully:', stats);
      return prisma.$disconnect().finally(() => process.exit(0));
    })
    .catch((error) => {
      console.error('Sync failed:', error);
      return prisma.$disconnect().finally(() => process.exit(1));
    });
}
