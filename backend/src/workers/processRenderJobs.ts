// src/workers/processRenderJobs.ts
import dotenv from 'dotenv';
import prisma from '../prismaClient';
import type { RenderJob, MediaItem } from '@prisma/client';

import { google } from 'googleapis';
import type { Credentials } from 'google-auth-library';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { promisify } from 'util';
import { pipeline } from 'stream';
import { spawn } from 'child_process';
import { getServiceAccountAuth } from '../utils/serviceAccountAuth';

dotenv.config();

const streamPipeline = promisify(pipeline);

type RenderJobWithRelations = RenderJob & {
  audioMediaItem: MediaItem;
  imageMediaItem: MediaItem | null;
};

function formatError(err: unknown): string {
  if (err instanceof Error) {
    return `${err.message}${err.stack ? ` | stack: ${err.stack.split('\n')[0]}` : ''}`;
  }
  return typeof err === 'string' ? err : 'Unknown error';
}

// ---- DRIVE CLIENTS ----

// Service account client: READ (download) from Drive
function getDriveReadClient() {
  const auth = getServiceAccountAuth([
    'https://www.googleapis.com/auth/drive.readonly',
  ]);

  const drive = google.drive({ version: 'v3', auth });
  return drive;
}

// OAuth client (your Gmail): WRITE (upload) to Drive
function getDriveWriteClient() {
  const tokensJson = process.env.DRIVE_OAUTH_TOKENS;
  if (!tokensJson) {
    throw new Error('DRIVE_OAUTH_TOKENS is not set');
  }

  const clientId = process.env.DRIVE_CLIENT_ID;
  const clientSecret = process.env.DRIVE_CLIENT_SECRET;
  const redirectUri =
    process.env.DRIVE_REDIRECT_URI || 'http://localhost:4000/oauth2callback';

  if (!clientId || !clientSecret) {
    throw new Error(
      'DRIVE_CLIENT_ID / DRIVE_CLIENT_SECRET are not set (needed for OAuth uploads)'
    );
  }

  let tokens: Credentials;
  try {
    tokens = JSON.parse(tokensJson) as Credentials;
  } catch {
    throw new Error('DRIVE_OAUTH_TOKENS is not valid JSON');
  }

  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    redirectUri
  );
  oauth2Client.setCredentials(tokens);

  console.log('[Drive OAuth] Using OAuth2 client for uploads');

  const drive = google.drive({ version: 'v3', auth: oauth2Client });
  return drive;
}

// ---- HELPERS ----

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9-_]+/g, '_').replace(/^_+|_+$/g, '');
}

function getTimestampString(date = new Date()): string {
  // 2025-12-07T21:03:45.123Z -> 2025-12-07T21-03-45-123Z
  return date.toISOString().replace(/:/g, '-').replace(/\./g, '-');
}

async function downloadDriveFileToTemp(
  drive: ReturnType<typeof getDriveReadClient>,
  fileId: string,
  label: string
): Promise<string> {
  console.log(`[${label}] Downloading Drive file ${fileId}...`);

  const res = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'stream' }
  );

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'render-job-'));
  const outPath = path.join(tmpDir, `${label}-${fileId}.bin`);

  const readStream = res.data as unknown as NodeJS.ReadableStream;
  const writeStream = fs.createWriteStream(outPath);

  await streamPipeline(readStream, writeStream);

  console.log(`[${label}] Downloaded to ${outPath}`);
  return outPath;
}

async function runFfmpegToMp4(
  imagePath: string,
  audioPath: string,
  outputPath: string
): Promise<void> {
  console.log(`[ffmpeg] Starting render:`);
  console.log(`[ffmpeg]   image: ${imagePath}`);
  console.log(`[ffmpeg]   audio: ${audioPath}`);
  console.log(`[ffmpeg]   output: ${outputPath}`);

  return new Promise((resolve, reject) => {
    const args = [
      '-y', // overwrite
      '-loop',
      '1',
      '-i',
      imagePath,
      '-i',
      audioPath,
      '-c:v',
      'libx264',
      '-c:a',
      'aac',
      '-b:a',
      '192k',
      '-shortest',
      '-pix_fmt',
      'yuv420p',
      outputPath,
    ];

    const ff = spawn('ffmpeg', args);

    ff.stdout.on('data', (data) => {
      console.log(`[ffmpeg stdout] ${data}`);
    });

    ff.stderr.on('data', (data) => {
      console.log(`[ffmpeg stderr] ${data}`);
    });

    ff.on('error', (err) => {
      console.error('[ffmpeg] Failed to start process:', err);
      reject(err);
    });

    ff.on('close', (code) => {
      if (code === 0) {
        console.log('[ffmpeg] Render completed successfully');
        resolve();
      } else {
        const err = new Error(`ffmpeg exited with code ${code}`);
        console.error('[ffmpeg] Render failed:', err);
        reject(err);
      }
    });
  });
}

async function uploadMp4ToDrive(
  localPath: string,
  baseName: string
): Promise<{ id: string; name: string }> {
  const outputFolderId = process.env.DRIVE_FOLDER_ID;
  if (!outputFolderId) {
    throw new Error('DRIVE_FOLDER_ID is not set');
  }

  // Use OAuth client here (user Drive quota)
  const drive = getDriveWriteClient();

  const timestamp = getTimestampString();
  const sanitizedBase = sanitizeFileName(baseName) || 'rendered_video';
  const finalName = `${sanitizedBase}_${timestamp}.mp4`;

  console.log(
    `[upload] Uploading ${localPath} to Drive folder ${outputFolderId} as ${finalName}...`
  );

  const fileMetadata = {
    name: finalName,
    parents: [outputFolderId],
  };

  const media = {
    mimeType: 'video/mp4',
    body: fs.createReadStream(localPath),
  };

  const res = await drive.files.create({
    requestBody: fileMetadata,
    media,
    fields: 'id,name',
  });

  const id = res.data.id;
  const name = res.data.name;

  if (!id || !name) {
    throw new Error('Drive file upload did not return id/name');
  }

  console.log(`[upload] Uploaded: id=${id}, name=${name}`);
  return { id, name };
}

// ---- MAIN JOB LOGIC ----

export async function processRenderJob(
  job: RenderJobWithRelations
): Promise<void> {
  // Idempotency: skip if already has output
  if (job.outputMediaItemId) {
    console.log(`Job ${job.id} already has output, skipping.`);
    return;
  }

  console.log(
    `Processing render job ${job.id}: audio="${job.audioMediaItem.name}" image="${job.imageMediaItem?.name ?? 'none'}"`
  );

  const driveRead = getDriveReadClient();
  const tempFiles: string[] = [];

  try {
    await prisma.renderJob.update({
      where: { id: job.id },
      data: { status: 'RUNNING' },
    });

    if (!job.audioMediaItem.driveFileId) {
      throw new Error('audioMediaItem.driveFileId is missing');
    }

    // 1. Download audio
    const audioPath = await downloadDriveFileToTemp(
      driveRead,
      job.audioMediaItem.driveFileId,
      `audio-${job.id}`
    );
    tempFiles.push(audioPath);

    // 2. Download image (or error)
    let imagePath: string;
    if (job.imageMediaItem && job.imageMediaItem.driveFileId) {
      imagePath = await downloadDriveFileToTemp(
        driveRead,
        job.imageMediaItem.driveFileId,
        `image-${job.id}`
      );
      tempFiles.push(imagePath);
    } else {
      throw new Error('imageMediaItem is missing for render job');
    }

    // 3. Run ffmpeg to create MP4
    const tmpDir = path.dirname(audioPath);
    const outputPath = path.join(tmpDir, `rendered-${job.id}.mp4`);
    await runFfmpegToMp4(imagePath, audioPath, outputPath);
    tempFiles.push(outputPath);

    // 4. Upload MP4 to Drive (OAuth user)
    const uploadInfo = await uploadMp4ToDrive(
      outputPath,
      job.audioMediaItem.name
    );

    // 5. Create MediaItem for the MP4
    console.log(
      `[mediaItem] Creating MediaItem for uploaded MP4 (Drive id=${uploadInfo.id})`
    );

    const videoMediaItem = await prisma.mediaItem.create({
      data: {
        driveFileId: uploadInfo.id,
        name: uploadInfo.name,
        mimeType: 'video/mp4',
        status: 'ACTIVE',
      },
    });

    console.log(
      `[mediaItem] Created MediaItem ${videoMediaItem.id} for render job ${job.id}`
    );

    // 6. Link output to render job and mark success
    await prisma.renderJob.update({
      where: { id: job.id },
      data: {
        outputMediaItemId: videoMediaItem.id,
        status: 'SUCCESS',
      },
    });

    console.log(`Render job ${job.id} completed successfully`);
  } catch (error) {
    console.error(`Render job ${job.id} failed:`, error);

    const errorMessage = formatError(error);
    await prisma.renderJob.update({
      where: { id: job.id },
      data: {
        status: 'FAILED',
        errorMessage,
      },
    });
  } finally {
    // Cleanup temp files
    for (const filePath of tempFiles) {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          const dir = path.dirname(filePath);
          try {
            fs.rmdirSync(dir);
          } catch {
            // ignore if not empty
          }
        }
      } catch (err) {
        console.warn(
          `Failed to clean up temp file or dir "${filePath}":`,
          err
        );
      }
    }
  }
}

// ---- STANDALONE EXECUTION ----

async function main(): Promise<void> {
  console.log('Processing render jobs...');

  const jobs = await prisma.renderJob.findMany({
    where: { status: 'PENDING' },
    include: {
      audioMediaItem: true,
      imageMediaItem: true,
    },
    take: 10,
  });

  if (jobs.length === 0) {
    console.log('No render jobs to process.');
    await prisma.$disconnect();
    return;
  }

  console.log(`Found ${jobs.length} pending job(s).`);

  for (const job of jobs) {
    console.log('----------------------------------------');
    console.log(`Starting job ${job.id}...`);
    await processRenderJob(job);
  }

  console.log('Finished processing render jobs.');
  await prisma.$disconnect();
}

// Only run main if this file is executed directly
if (require.main === module) {
  main().catch(async (err: unknown) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
}
