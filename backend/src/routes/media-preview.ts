// src/routes/media.ts
import { Router } from 'express';
import { google } from 'googleapis';
import path from 'node:path';

const router = Router();

// --- Drive client ---

function getDriveClient() {
  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!keyPath) throw new Error('GOOGLE_APPLICATION_CREDENTIALS not set');

  const auth = new google.auth.GoogleAuth({
    keyFile: path.resolve(keyPath),
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });

  return google.drive({ version: 'v3', auth });
}

// --- generic helper to stream any Drive file ---

async function streamDriveFile(
  driveFileId: string,
  res: any,
  fallbackMime: string
) {
  try {
    const drive = getDriveClient();

    const meta = await drive.files.get({
      fileId: driveFileId,
      fields: 'id, name, mimeType, size',
      supportsAllDrives: true,
    });

    const mimeType = meta.data.mimeType || fallbackMime;
    const size = meta.data.size ? parseInt(meta.data.size, 10) : undefined;

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

    driveRes.data.on('error', (err: any) => {
      console.error('Drive stream error:', err);
      if (!res.headersSent) {
        res.status(500).end('Error streaming file');
      } else {
        res.end();
      }
    });

    driveRes.data.pipe(res);
  } catch (err) {
    console.error('Error streaming drive file:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to stream file' });
    }
  }
}

// --- routes mounted under /media ---

// GET /media/:driveFileId/image
router.get('/:driveFileId/image', async (req, res) => {
  const { driveFileId } = req.params;
  await streamDriveFile(driveFileId, res, 'image/png');
});

// GET /media/:driveFileId/audio
router.get('/:driveFileId/audio', async (req, res) => {
  const { driveFileId } = req.params;
  await streamDriveFile(driveFileId, res, 'audio/mpeg');
});

// GET /media/:driveFileId/video
router.get('/:driveFileId/video', async (req, res) => {
  const { driveFileId } = req.params;
  await streamDriveFile(driveFileId, res, 'video/mp4');
});

export default router;
