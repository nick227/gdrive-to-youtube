import type { MediaStatus, VideoStatus, JobStatus, PrivacyStatus } from './enums';

// Re-export enums for convenience
export type { MediaStatus, VideoStatus, JobStatus, PrivacyStatus };

// ============================================================================
// API Response Types (match Prisma models after JSON serialization)
// ============================================================================

export interface MediaItem {
  id: number;
  driveFileId: string;
  name: string;
  mimeType: string;
  sizeBytes: string | null;
  folderId?: string | null;
  folderPath?: string | null;   // 👈 use in table
  webViewLink?: string | null;
  webContentLink?: string | null;
  status: 'ACTIVE' | 'MISSING' | string;
  createdAt: string;
  updatedAt: string;
}

export interface YoutubeChannel {
  id: number;
  channelId: string;
  title: string | null;
  ownerUserId: number | null;
  accessToken: string | null;
  refreshToken: string | null;
  scopes: string | null;
  createdAt: string;
  updatedAt: string;
  ownerUser?: {
    id: number;
    email: string;
    name: string | null;
  };
}

export interface YoutubeVideo {
  id: number;
  mediaItemId: number;
  youtubeChannelId: number;
  youtubeVideoId: string | null;
  title: string;
  description: string;
  tags: string | null;
  privacyStatus: PrivacyStatus;
  publishAt: string | null;
  status: VideoStatus; // FIXED: was wrong enum values
  createdAt: string;
  updatedAt: string;
  mediaItem?: MediaItem;
  youtubeChannel?: YoutubeChannel;
}

export interface UploadJob {
  id: number;
  mediaItemId: number;
  youtubeChannelId: number;
  requestedByUserId: number;
  youtubeVideoId: number | null; // ADDED: was missing
  title: string;
  description: string;
  tags: string | null;
  privacyStatus: PrivacyStatus;
  scheduledFor: string | null;
  status: JobStatus;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  mediaItem?: MediaItem;
  youtubeChannel?: YoutubeChannel;
  youtubeVideo?: YoutubeVideo | null;
}

export interface RenderJob {
  id: number;
  audioMediaItemId: number;
  imageMediaItemId: number | null; // FIXED: was required, should be nullable
  outputMediaItemId: number | null;
  waveformConfig: string | null; // ADDED: was missing
  status: JobStatus;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  audioMediaItem?: MediaItem;
  imageMediaItem?: MediaItem | null;
  outputMediaItem?: MediaItem | null;
}

// ============================================================================
// API Request Types
// ============================================================================

export interface CreateUploadJobRequest {
  mediaItemId: number;
  youtubeChannelId: number;
  title: string;
  description: string;
  tags?: string[];
  privacyStatus: PrivacyStatus;
  scheduledFor?: string;
}

export interface CreateRenderJobRequest {
  audioMediaItemId: number;
  imageMediaItemId?: number; // Optional per Prisma schema
  waveformConfig?: string;
}
