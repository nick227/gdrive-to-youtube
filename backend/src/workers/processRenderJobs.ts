// src/workers/processRenderJobs.ts
import dotenv from 'dotenv';
import prisma from '../prismaClient';
import type { MediaItem } from '@prisma/client';
import fs from 'fs';
import os from 'os';
import path from 'path';
import fsPromises from 'fs/promises';
import { parseRenderSpec, RenderSpec } from '../rendering/renderSpec';
import { downloadMediaBatch } from '../rendering/download';
import {
  buildSlideshowFrames,
  concatAudios,
  createSlideshowVideo,
  getAudioDurationSeconds,
  muxAudioAndVideo,
} from '../rendering/slideshow';
import { renderWaveformVideo } from '../rendering/waveform';
import { uploadMp4ToDrive } from '../rendering/upload';
import {
  RenderJobWithRelations,
  resolveRenderMedia,
} from '../rendering/mediaResolver';
import { getDriveClientById } from '../utils/driveConnectionClient';
import { runRenderJobIsolated } from './renderJobIsolation';

dotenv.config();

function formatError(err: unknown): string {
  if (err instanceof Error) {
    return `${err.message}${err.stack ? ` | stack: ${err.stack.split('\n')[0]}` : ''}`;
  }
  return typeof err === 'string' ? err : 'Unknown error';
}

type RenderOutput = {
  outputPath: string;
  baseName: string;
};

async function renderFromSpec(
  jobId: number,
  spec: RenderSpec | null,
  audioPaths: string[],
  imagePaths: string[],
  tempFiles: string[],
  audioItems: MediaItem[],
  _imageItems: MediaItem[]
): Promise<RenderOutput> {
  const removeFiles = async (paths: string[]) => {
    await Promise.all(
      paths.map((filePath) => fsPromises.rm(filePath, { force: true }).catch(() => {}))
    );
  };
  if (audioPaths.length === 0) {
    throw new Error('No audio tracks downloaded for render');
  }

  const tmpDir = path.dirname(audioPaths[0]);
  const mergedAudioPath = await concatAudios(audioPaths, tmpDir, tempFiles);
  if (audioPaths.length > 1) {
    await removeFiles(audioPaths);
  }
  const totalAudioSeconds = await getAudioDurationSeconds(mergedAudioPath);
  if (!totalAudioSeconds || Number.isNaN(totalAudioSeconds)) {
    throw new Error('Audio duration is invalid or zero');
  }

  const outputPath = path.join(tmpDir, `rendered-${jobId}.mp4`);
  tempFiles.push(outputPath);

  // Slideshow: multi-asset support
  if (!spec || spec.mode === 'slideshow') {
    // TODO: Once renderSpec is always persisted, drop the !spec legacy fallback (target: next release).
    if (imagePaths.length === 0) {
      throw new Error('Slideshow render requires at least one image');
    }

    const perImageSeconds = (() => {
      const provided = spec?.intervalSeconds ?? 0;
      const auto = spec?.autoTime ?? false;
      if (auto && totalAudioSeconds && imagePaths.length > 0) {
        return totalAudioSeconds / imagePaths.length;
      }
      if (provided > 0) return provided;
      if (totalAudioSeconds && imagePaths.length > 0) {
        return totalAudioSeconds / imagePaths.length;
      }
      return 5; // fallback
    })();

    const frames = buildSlideshowFrames(
      imagePaths,
      totalAudioSeconds,
      perImageSeconds,
      spec?.repeatImages ?? false
    );

    const slideshowVideo = await createSlideshowVideo(frames, tmpDir, tempFiles);
    await removeFiles(imagePaths);
    await muxAudioAndVideo(slideshowVideo, mergedAudioPath, outputPath);
    await removeFiles([slideshowVideo, mergedAudioPath]);

    const baseName =
      spec?.outputFileName ||
      (audioItems.length > 0 ? audioItems[0].name : 'rendered_video');
    return { outputPath, baseName };
  }

  // Waveform render.
  if (spec.mode === 'waveform') {
    await renderWaveformVideo(mergedAudioPath, outputPath, {
      backgroundColor: spec.backgroundColor,
      waveColor: spec.waveColor,
      waveStyle: spec.waveStyle,
    });
    await removeFiles([mergedAudioPath]);

    const baseName =
      spec.outputFileName ||
      (audioItems.length > 0 ? audioItems[0].name : 'rendered_video');
    return { outputPath, baseName };
  }

  // Exhaustive guard
  throw new Error(`Unsupported render mode: ${(spec as { mode?: string }).mode ?? 'unknown'}`);
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

  const spec = parseRenderSpec(job.renderSpec);
  console.log(
    `Processing render job ${job.id} (mode=${spec?.mode ?? 'legacy'}): audio="${job.audioMediaItem.name}" image="${job.imageMediaItem?.name ?? 'none'}"`
  );

  const tempFiles: string[] = [];
  const tempDirs = new Set<string>();
  const jobTempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'render-job-'));
  tempDirs.add(jobTempDir);

  try {
    const { spec: resolvedSpec, audioItems, imageItems } = await resolveRenderMedia(job, spec);

    // 1. Resolve drive connection for this job
    const connectionIdCandidates = new Set<string>();
    if (job.driveConnectionId) connectionIdCandidates.add(job.driveConnectionId);
    for (const item of [...audioItems, ...imageItems]) {
      if (item?.driveConnectionId) connectionIdCandidates.add(item.driveConnectionId);
    }

    if (connectionIdCandidates.size === 0) {
      throw new Error('driveConnectionId is required (no Drive connection on job or media)');
    }
    if (connectionIdCandidates.size > 1) {
      throw new Error('Mixed drive connections detected across media items; expected one');
    }
    const driveConnectionId = Array.from(connectionIdCandidates)[0]!;

    const { drive, connection } = await getDriveClientById(driveConnectionId);

    // Mark RUNNING only if still eligible (after validation)
    const updated = await prisma.renderJob.updateMany({
      where: { id: job.id, status: { in: ['PENDING', 'RUNNING', 'FAILED'] } },
      data: { status: 'RUNNING', errorMessage: null },
    });
    if (updated.count === 0) {
      console.log(`Job ${job.id} not eligible to run (status changed), skipping.`);
      return;
    }

    // Backfill job with the resolved connection for future runs
    if (!job.driveConnectionId && driveConnectionId) {
      await prisma.renderJob.update({
        where: { id: job.id },
        data: { driveConnectionId },
      });
    }

    const audioPaths = await downloadMediaBatch(
      drive,
      audioItems,
      'audio',
      tempFiles,
      jobTempDir
    );
    const shouldDownloadImages = !resolvedSpec || resolvedSpec.mode === 'slideshow';
    const imagePaths = shouldDownloadImages
      ? await downloadMediaBatch(drive, imageItems, 'image', tempFiles, jobTempDir)
      : [];

    // 2. Render into MP4
    const { outputPath, baseName } = await renderFromSpec(
      job.id,
      resolvedSpec,
      audioPaths,
      imagePaths,
      tempFiles,
      audioItems,
      imageItems
    );

    // 3. Upload MP4 to Drive (OAuth user)
    const uploadInfo = await uploadMp4ToDrive({
      driveConnectionId,
      localPath: outputPath,
      baseName,
    });

    // 4. Create MediaItem for the MP4
    console.log(
      `[mediaItem] Creating MediaItem for uploaded MP4 (Drive id=${uploadInfo.id})`
    );

    // 4. Create MediaItem and mark job success in a transaction, avoid duplicate outputs
    const videoMediaItem = await prisma.$transaction(async (tx) => {
      // If job already has an output, return it (idempotency guard)
      const existing = await tx.renderJob.findUnique({
        where: { id: job.id },
        select: { outputMediaItemId: true },
      });
      if (existing?.outputMediaItemId) {
        const existingItem = await tx.mediaItem.findUnique({
          where: { id: existing.outputMediaItemId },
        });
        if (existingItem) return existingItem;
      }

      const created = await tx.mediaItem.create({
        data: {
          driveFileId: uploadInfo.id,
          name: uploadInfo.name,
          mimeType: 'video/mp4',
          status: 'ACTIVE',
          driveConnectionId: connection.id,
        },
      });

      await tx.renderJob.update({
        where: { id: job.id },
        data: {
          outputMediaItemId: created.id,
          status: 'SUCCESS',
        },
      });

      return created;
    });

    console.log(
      `[mediaItem] Created MediaItem ${videoMediaItem.id} for render job ${job.id}`
    );

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
    // Cleanup temp files/dirs (best-effort, async)
    await Promise.all(
      tempFiles.map(async (filePath) => {
        try {
          await fsPromises.rm(filePath, { force: true });
          tempDirs.add(path.dirname(filePath));
        } catch (err) {
          if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
            console.warn(`Failed to clean up temp file "${filePath}":`, err);
          }
        }
      })
    );
    await Promise.all(
      Array.from(tempDirs).map(async (dir) => {
        try {
          await fsPromises.rm(dir, { recursive: true, force: true });
        } catch (err) {
          console.warn(`Failed to remove temp dir "${dir}":`, err);
        }
      })
    );
  }
}

// ---- STANDALONE EXECUTION ----

async function main(): Promise<void> {
  console.log('Processing render jobs...');

  let processed = 0;
  while (true) {
    const job = await prisma.renderJob.findFirst({
      where: { status: 'PENDING' },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });

    if (!job) break;

    console.log('----------------------------------------');
    console.log(`Starting job ${job.id}...`);
    const result = await runRenderJobIsolated(job.id);
    if (result.code === 0) {
      processed += 1;
    } else {
      await prisma.renderJob.updateMany({
        where: { id: job.id, status: { in: ['PENDING', 'RUNNING'] } },
        data: {
          status: 'FAILED',
          errorMessage: `Render worker exited with code ${result.code ?? 'unknown'}${
            result.signal ? ` (signal ${result.signal})` : ''
          }`,
        },
      });
    }
  }

  if (processed === 0) {
    console.log('No render jobs to process.');
    await prisma.$disconnect();
    return;
  }

  console.log(`Finished processing ${processed} render job(s).`);

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
