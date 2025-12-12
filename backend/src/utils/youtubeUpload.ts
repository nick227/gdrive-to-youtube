import { google, youtube_v3 } from 'googleapis';
import { getOrRefreshChannelAuth } from './youtubeAuth';
import { PrivacyStatus } from '@prisma/client';
import { Readable } from 'stream';
import { getServiceAccountAuth } from './serviceAccountAuth';

export async function uploadVideoToYouTube(
  channelId: string,
  mediaItemId: number,
  title: string,
  description: string,
  tags: string[] | null,
  privacyStatus: PrivacyStatus,
  videoStream: Readable,
  videoSize: number,
  publishAt?: Date
): Promise<string> {
  const auth = await getOrRefreshChannelAuth(channelId);
  const youtube = google.youtube({ version: 'v3', auth });

  const tagsArray = tags || [];
  const privacyMap: Record<PrivacyStatus, string> = {
    PUBLIC: 'public',
    UNLISTED: 'unlisted',
    PRIVATE: 'private',
  };

  // If scheduling, use private status with publishAt
  const effectivePrivacy = publishAt ? 'private' : privacyMap[privacyStatus];

  const insertParams: youtube_v3.Params$Resource$Videos$Insert = {
    part: ['snippet', 'status'],
    requestBody: {
      snippet: {
        title,
        description,
        tags: tagsArray,
      },
      status: {
        privacyStatus: effectivePrivacy,
        ...(publishAt && { publishAt: publishAt.toISOString() }),
      },
    },
    media: {
      body: videoStream,
    },
  };

  const response = await youtube.videos.insert(insertParams);
  const videoId = response.data?.id;

  if (!videoId) {
    throw new Error('No video ID returned from YouTube');
  }

  return videoId;
}

export async function downloadFileFromDrive(driveFileId: string): Promise<{ stream: Readable; size: number }> {
  const auth = getServiceAccountAuth([
    'https://www.googleapis.com/auth/drive.readonly',
  ]);

  const drive = google.drive({ version: 'v3', auth });

  const fileMetadata = await drive.files.get({
    fileId: driveFileId,
    fields: 'size',
  });

  const sizeString = (fileMetadata.data as { size?: string }).size;
  const fileSize = sizeString ? parseInt(sizeString, 10) : 0;

  const fileResponse = await drive.files.get(
    {
      fileId: driveFileId,
      alt: 'media',
    },
    { responseType: 'stream' }
  );

  return {
    stream: fileResponse.data as Readable,
    size: fileSize,
  };
}

async function downloadImageFromDrive(driveFileId: string): Promise<Readable> {
  const auth = getServiceAccountAuth([
    'https://www.googleapis.com/auth/drive.readonly',
  ]);

  const drive = google.drive({ version: 'v3', auth });

  const fileResponse = await drive.files.get(
    {
      fileId: driveFileId,
      alt: 'media',
    },
    { responseType: 'stream' }
  );

  return fileResponse.data as Readable;
}

export async function uploadVideoThumbnailFromDrive(
  channelId: string,
  youtubeVideoId: string,
  driveFileId: string
): Promise<void> {
  const auth = await getOrRefreshChannelAuth(channelId);
  const youtube = google.youtube({ version: 'v3', auth });

  const thumbnailStream = await downloadImageFromDrive(driveFileId);

  await youtube.thumbnails.set({
    videoId: youtubeVideoId,
    media: { body: thumbnailStream },
  });
}

