// src/workers/syncDrive.ts
import dotenv from 'dotenv';
import { google, drive_v3 } from 'googleapis';
import prisma from '../prismaClient';
import { getServiceAccountAuth } from '../utils/serviceAccountAuth';

dotenv.config();

interface SyncStats {
  upserted: number;
  markedMissing: number;
}

const DRIVE_SCOPES = ['https://www.googleapis.com/auth/drive.readonly'];
const PAGE_SIZE = 100;
const DEFAULT_MIME_TYPE = 'application/octet-stream';

// Cache for folder paths to avoid repeated Drive lookups
const folderPathCache = new Map<string, string>();

/**
 * Validates and retrieves required environment variables
 */
export interface DriveConfig {
  folderId: string;
}

function getConfig(): DriveConfig {
  const folderId = process.env.DRIVE_FOLDER_ID;

  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS || !folderId) {
    throw new Error(
      'Missing required environment variables: GOOGLE_APPLICATION_CREDENTIALS and/or DRIVE_FOLDER_ID'
    );
  }

  return { folderId };
}

/**
 * Initializes Google Drive API client
 */
function initializeDriveClient(): drive_v3.Drive {
  const auth = getServiceAccountAuth(DRIVE_SCOPES);

  return google.drive({ version: 'v3', auth });
}

/**
 * Recursively fetches all files under a root Drive folder (including nested folders)
 */
async function fetchAllDescendantFiles(
  drive: drive_v3.Drive,
  rootFolderId: string
): Promise<drive_v3.Schema$File[]> {
  const allFiles: drive_v3.Schema$File[] = [];
  const folderQueue: string[] = [rootFolderId];

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
      }

      pageToken = response.data.nextPageToken || undefined;
    } while (pageToken);
  }

  return allFiles;
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
  folderPath: string | null
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
async function markMissingFiles(seenIds: Set<string>): Promise<number> {
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
      driveFileId: { notIn: seenIdsArray },
    },
    data: {
      status: 'MISSING',
    },
  });

  return result.count;
}


/**
 * Syncs files from Google Drive to the database
 */
export async function syncDrive(): Promise<SyncStats> {
  const config = getConfig();
  console.log('Syncing files from Drive folder:', config.folderId);

  const drive = initializeDriveClient();
  const seenIds = new Set<string>();

  try {
    // Fetch all files (recursively) from Drive root folder
    const files = await fetchAllDescendantFiles(drive, config.folderId);

    // Upsert each file to database
    for (const file of files) {
      if (!file.id) continue;

      seenIds.add(file.id);

      const parentId = file.parents?.[0] ?? null;
      const folderPath = await getFolderPath(drive, parentId, config.folderId);

      await upsertFile(file, folderPath);
    }

    // Mark files that are no longer in Drive as MISSING
    const markedMissing = await markMissingFiles(seenIds);

    const stats: SyncStats = {
      upserted: seenIds.size,
      markedMissing,
    };

    console.log(`Sync complete. Upserted ${stats.upserted} file(s) to MediaItem.`);
    console.log(`Marked ${stats.markedMissing} file(s) as MISSING.`);

    return stats;
  } catch (error) {
    console.error('Error during Drive sync:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Main execution
if (require.main === module) {
  syncDrive()
    .then((stats) => {
      console.log('Sync completed successfully:', stats);
      process.exit(0);
    })
    .catch((error) => {
      console.error('Sync failed:', error);
      process.exit(1);
    });
}
