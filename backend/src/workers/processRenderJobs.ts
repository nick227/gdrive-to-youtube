// src/workers/processRenderJobs.ts
import dotenv from 'dotenv';
import prisma from '../prismaClient';
import type { MediaItem } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { parseRenderSpec, RenderSpec } from '../rendering/renderSpec';
import { downloadMediaBatch } from '../rendering/download';
import {
  buildSlideshowFrames,
  concatAudios,
  createSlideshowVideo,
  getAudioDurationSeconds,
  muxAudioAndVideo,
} from '../rendering/slideshow';
import { uploadMp4ToDrive } from '../rendering/upload';
import {
  RenderJobWithRelations,
  resolveRenderMedia,
} from '../rendering/mediaResolver';
import { getDriveClientById } from '../utils/driveConnectionClient';
import { DriveConnectionStatus } from '@prisma/client';

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
  imageItems: MediaItem[]
): Promise<RenderOutput> {
  if (audioPaths.length === 0) {
    throw new Error('No audio tracks downloaded for render');
  }

  const tmpDir = path.dirname(audioPaths[0]);
  const mergedAudioPath = await concatAudios(audioPaths, tmpDir, tempFiles);
  const totalAudioSeconds = await getAudioDurationSeconds(mergedAudioPath);

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
    await muxAudioAndVideo(slideshowVideo, mergedAudioPath, outputPath);

    const baseName = spec?.outputFileName || audioItems[0]?.name || 'rendered_video';
    return { outputPath, baseName };
  }

  // Waveform placeholder: pipeline not implemented yet.
  if (spec.mode === 'waveform') {
    throw new Error('Waveform rendering is not implemented yet');
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

  try {
    await prisma.renderJob.update({
      where: { id: job.id },
      data: { status: 'RUNNING' },
    });

    const { spec: resolvedSpec, audioItems, imageItems } = await resolveRenderMedia(job, spec);

    // 1. Resolve drive connection for this job
    const connectionIdCandidates = new Set<string>();
    if (job.driveConnectionId) connectionIdCandidates.add(job.driveConnectionId);
    for (const item of [...audioItems, ...imageItems]) {
      if (item?.driveConnectionId) connectionIdCandidates.add(item.driveConnectionId);
    }

    let driveConnectionId: string | null = null;
    if (connectionIdCandidates.size === 1) {
      driveConnectionId = Array.from(connectionIdCandidates)[0]!;
    } else if (connectionIdCandidates.size > 1) {
      throw new Error('Mixed drive connections detected across media items; expected one');
    } else {
      const fallback = await prisma.driveConnection.findFirst({
        where: { status: DriveConnectionStatus.ACTIVE },
        orderBy: { createdAt: 'desc' },
      });
      if (!fallback) {
        throw new Error('No active Drive connection available; please connect Google Drive');
      }
      driveConnectionId = fallback.id;
    }

    const { drive, connection } = await getDriveClientById(driveConnectionId);

    // Backfill job with the resolved connection for future runs
    if (!job.driveConnectionId && driveConnectionId) {
      await prisma.renderJob.update({
        where: { id: job.id },
        data: { driveConnectionId },
      });
    }

    const audioPaths = await downloadMediaBatch(drive, audioItems, 'audio', tempFiles);
    const imagePaths = await downloadMediaBatch(drive, imageItems, 'image', tempFiles);

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

    const videoMediaItem = await prisma.mediaItem.create({
      data: {
        driveFileId: uploadInfo.id,
        name: uploadInfo.name,
        mimeType: 'video/mp4',
        status: 'ACTIVE',
        driveConnectionId: connection.id,
      },
    });

    console.log(
      `[mediaItem] Created MediaItem ${videoMediaItem.id} for render job ${job.id}`
    );

    // 5. Link output to render job and mark success
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
    const tempDirs = new Set<string>();
    for (const filePath of tempFiles) {
      try {
        if (fs.existsSync(filePath)) {
          tempDirs.add(path.dirname(filePath));
          fs.unlinkSync(filePath);
        }
      } catch (err) {
        console.warn(`Failed to clean up temp file "${filePath}":`, err);
      }
    }
    for (const dir of tempDirs) {
      try {
        fs.rmdirSync(dir);
      } catch {
        // ignore if not empty
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
