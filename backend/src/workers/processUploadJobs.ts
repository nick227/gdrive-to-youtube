import dotenv from 'dotenv';
import prisma from '../prismaClient';
import { uploadVideoToYouTube, downloadFileFromDrive, uploadVideoThumbnailFromDrive } from '../utils/youtubeUpload';
import type { UploadJob, MediaItem, YoutubeChannel } from '@prisma/client';

dotenv.config();

type UploadJobWithRelations = UploadJob & {
  mediaItem: MediaItem;
  youtubeChannel: YoutubeChannel;
  thumbnailMediaItem?: MediaItem | null;
};

export async function processUploadJob(job: UploadJobWithRelations): Promise<void> {
  // Idempotency: skip if already has youtubeVideoId
  if (job.youtubeVideoId) {
    console.log(`Job ${job.id} already has youtubeVideoId, skipping.`);
    return;
  }

  try {
    console.log(`Processing job ${job.id}: ${job.title}`);
    
    await prisma.uploadJob.update({
      where: { id: job.id },
      data: { status: 'RUNNING' },
    });

    if (!job.youtubeChannel.accessToken) {
      throw new Error(`Channel ${job.youtubeChannel.channelId} is not authenticated`);
    }

    if (!job.mediaItem.driveFileId) {
      throw new Error(`MediaItem ${job.mediaItemId} has no driveFileId`);
    }

    console.log(`Downloading file from Drive: ${job.mediaItem.driveFileId}`);
    const { stream, size } = await downloadFileFromDrive(job.mediaItem.driveFileId);

    const tags = job.tags ? JSON.parse(job.tags) : null;

    console.log(`Uploading to YouTube channel: ${job.youtubeChannel.channelId}`);
    const youtubeVideoId = await uploadVideoToYouTube(
      job.youtubeChannel.channelId,
      job.mediaItemId,
      job.title,
      job.description,
      tags,
      job.privacyStatus,
      stream,
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
          job.youtubeChannel.channelId,
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
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await prisma.uploadJob.update({
      where: { id: job.id },
      data: {
        status: 'FAILED',
        errorMessage: errorMessage.substring(0, 191),
      },
    });
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
