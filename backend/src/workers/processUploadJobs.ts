import dotenv from 'dotenv';
import prisma from '../prismaClient';
import { uploadVideoToYouTube, downloadFileFromDrive, uploadVideoThumbnailFromDrive } from '../utils/youtubeUpload';
import type { UploadJob, MediaItem, YoutubeChannel } from '@prisma/client';
import { getUserChannelAuth } from '../utils/youtubeAuth';
import { Readable } from 'stream';

dotenv.config();

type UploadJobWithRelations = UploadJob & {
  mediaItem: MediaItem;
  youtubeChannel: YoutubeChannel;
  thumbnailMediaItem?: MediaItem | null;
};

function formatError(err: unknown): string {
  if (err instanceof Error) {
    return `${err.message}${err.stack ? ` | stack: ${err.stack.split('\n')[0]}` : ''}`;
  }
  return typeof err === 'string' ? err : 'Unknown error';
}

export async function processUploadJob(job: UploadJobWithRelations): Promise<void> {
  // Claim the job atomically; skip if already processed
  const claimed = await prisma.uploadJob.updateMany({
    where: { id: job.id, status: { in: ['PENDING', 'RUNNING'] } },
    data: { status: 'RUNNING' },
  });
  if (claimed.count === 0) {
    console.log(`Job ${job.id} already claimed or not pending, skipping.`);
    return;
  }

  try {
    console.log(`Processing job ${job.id}: ${job.title}`);
    
    const auth = await getUserChannelAuth(job.requestedByUserId, job.youtubeChannel.channelId);

    if (!job.mediaItem.driveFileId) {
      throw new Error(`MediaItem ${job.mediaItemId} has no driveFileId`);
    }

    console.log(`Downloading file from Drive: ${job.mediaItem.driveFileId}`);
    let videoStream: Readable | undefined;
    let size = 0;
    try {
      const download = await downloadFileFromDrive(job.mediaItem.driveFileId);
      videoStream = download.stream;
      size = download.size;
    } catch (err) {
      throw new Error(`Failed to download media from Drive: ${String(err)}`);
    }

    let tags: string[] | null = null;
    if (job.tags) {
      try {
        const parsed = JSON.parse(job.tags);
        if (Array.isArray(parsed)) {
          tags = parsed.filter((t) => typeof t === 'string');
        }
      } catch {
        tags = null;
      }
    }

    console.log(`Uploading to YouTube channel: ${job.youtubeChannel.channelId} (job ${job.id})`);
    const youtubeVideoId = await uploadVideoToYouTube(
      auth,
      job.title,
      job.description,
      tags,
      job.privacyStatus,
      videoStream!,
      size,
      job.scheduledFor ?? undefined
    );

    console.log(`Upload successful! YouTube video ID: ${youtubeVideoId}`);

    // Determine video status based on scheduling
    const videoStatus = job.scheduledFor ? 'SCHEDULED' : 'PUBLISHED';

    const newYoutubeVideo = await prisma.youtubeVideo.create({
      data: {
        mediaItemId: job.mediaItemId,
        youtubeChannelId: job.youtubeChannelId,
        youtubeVideoId,
        title: job.title,
        description: job.description,
        tags: job.tags,
        privacyStatus: job.privacyStatus,
        publishAt: job.scheduledFor,
        status: videoStatus,
        thumbnailMediaItemId: job.thumbnailMediaItemId ?? null,
      },
    });

    // If a thumbnail was provided, upload it to YouTube
    if (job.thumbnailMediaItem?.driveFileId) {
      try {
        await uploadVideoThumbnailFromDrive(
          auth,
          youtubeVideoId,
          job.thumbnailMediaItem.driveFileId
        );
      } catch (thumbErr) {
        console.warn(`Failed to upload thumbnail for job ${job.id}:`, thumbErr);
      }
    }

    // Link YoutubeVideo to UploadJob and mark success
    await prisma.uploadJob.update({
      where: { id: job.id },
      data: {
        youtubeVideoId: newYoutubeVideo.id,
        status: 'SUCCESS',
      },
    });

    console.log(`Job ${job.id} completed successfully`);
  } catch (error) {
    console.error(`Job ${job.id} failed:`, error);

    const errorMessage = formatError(error);
    await prisma.uploadJob.update({
      where: { id: job.id },
      data: {
        status: 'FAILED',
        errorMessage,
      },
    });
  } finally {
    // Nothing to do; streams are destroyed inside upload helpers when needed
  }
}

// Standalone execution
async function main() {
  console.log('Processing upload jobs...');

  const now = new Date();

  const jobs = await prisma.uploadJob.findMany({
    where: {
      status: 'PENDING',
      OR: [
        { scheduledFor: null },
        { scheduledFor: { lte: now } },
      ],
    },
    include: {
      mediaItem: true,
      youtubeChannel: true,
      thumbnailMediaItem: true,
    },
    take: 10,
  });

  if (jobs.length === 0) {
    console.log('No jobs to process.');
    await prisma.$disconnect();
    return;
  }

  for (const job of jobs) {
    await processUploadJob(job);
  }

  console.log('Finished processing jobs.');
  await prisma.$disconnect();
}

// Only run main if this file is executed directly
if (require.main === module) {
  main().catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
}
