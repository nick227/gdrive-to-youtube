import fs from 'fs';
import os from 'os';
import path from 'path';
import { promisify } from 'util';
import { pipeline } from 'stream';
import type { MediaItem } from '@prisma/client';
import type { drive_v3 } from 'googleapis';

const streamPipeline = promisify(pipeline);

export async function downloadDriveFileToTemp(
  drive: drive_v3.Drive,
  fileId: string,
  label: string,
  baseDir?: string
): Promise<string> {
  console.log(`[${label}] Downloading Drive file ${fileId}...`);

  const res = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'stream' }
  );

  const tmpDir = baseDir
    ? baseDir
    : fs.mkdtempSync(path.join(os.tmpdir(), 'render-job-'));
  const outPath = path.join(tmpDir, `${label}-${fileId}.bin`);

  const readStream = res.data as unknown as NodeJS.ReadableStream;
  const writeStream = fs.createWriteStream(outPath);

  await streamPipeline(readStream, writeStream);

  console.log(`[${label}] Downloaded to ${outPath}`);
  return outPath;
}

export function ensureDriveFileId(item: MediaItem, label: string): string {
  if (!item.driveFileId) {
    throw new Error(`${label} (id=${item.id}) is missing driveFileId`);
  }
  return item.driveFileId;
}

export async function downloadMediaBatch(
  driveRead: drive_v3.Drive,
  items: MediaItem[],
  labelPrefix: string,
  tempFiles: string[],
  baseDir?: string
): Promise<string[]> {
  const paths: string[] = [];
  for (const item of items) {
    const driveId = ensureDriveFileId(item, labelPrefix);
    const pathOnDisk = await downloadDriveFileToTemp(
      driveRead,
      driveId,
      `${labelPrefix}-${item.id}`,
      baseDir
    );
    tempFiles.push(pathOnDisk);
    paths.push(pathOnDisk);
  }
  return paths;
}
