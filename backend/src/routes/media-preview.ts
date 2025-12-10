// src/routes/media.ts
import { Router, type Response } from 'express';
import { google } from 'googleapis';
import { getServiceAccountAuth } from '../utils/serviceAccountAuth';

const router = Router();

// --- Drive client ---

function getDriveClient() {
  const auth = getServiceAccountAuth([
    'https://www.googleapis.com/auth/drive.readonly',
  ]);

  return google.drive({ version: 'v3', auth });
}

// --- generic helper to stream Drive file ---

async function streamDriveFile(
  driveFileId: string,
  res: Response,
  fallbackMime: string
): Promise<void> {
  try {
    const drive = getDriveClient();

    const meta = await drive.files.get({
      fileId: driveFileId,
      fields: 'id, name, mimeType, size',
      supportsAllDrives: true,
    });

    const mimeType = meta.data.mimeType ?? fallbackMime;
    const size = meta.data.size ? Number(meta.data.size) : undefined;

    res.status(200);
    res.setHeader('Content-Type', mimeType);
    if (size) {
      res.setHeader('Content-Length', size);
    }
    res.setHeader('Accept-Ranges', 'bytes');

    const driveRes = await drive.files.get(
      {
        fileId: driveFileId,
        alt: 'media',
        supportsAllDrives: true,
      },
      { responseType: 'stream' }
    );

    driveRes.data.on('error', (err: unknown) => {
      console.error('Drive stream error:', err);
      if (!res.headersSent) {
        res.status(500).end('Error streaming file');
      } else {
        res.end();
      }
    });

    driveRes.data.pipe(res);
  } catch (err: unknown) {
    console.error('Error streaming drive file:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to stream file' });
    }
  }
}

// --- routes mounted under /media ---

router.get('/:driveFileId/image', async (req, res) => {
  await streamDriveFile(req.params.driveFileId, res, 'image/png');
});

router.get('/:driveFileId/audio', async (req, res) => {
  await streamDriveFile(req.params.driveFileId, res, 'audio/mpeg');
});

router.get('/:driveFileId/video', async (req, res) => {
  await streamDriveFile(req.params.driveFileId, res, 'video/mp4');
});

export default router;
