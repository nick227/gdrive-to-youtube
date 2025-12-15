import type { MediaStatus, VideoStatus, JobStatus, PrivacyStatus } from './enums';
import type { RenderSpec } from './render';

// Re-export enums for convenience
export type { MediaStatus, VideoStatus, JobStatus, PrivacyStatus };
export type { RenderSpec } from './render';

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
  thumbnailMediaItemId?: number | null;
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
  thumbnailMediaItem?: MediaItem | null;
  youtubeChannel?: YoutubeChannel;
  youtubeVideo?: YoutubeVideo | null;
  requestedByUser?: {
    id: number;
    email: string;
    name: string | null;
  } | null;
}

export interface RenderJob {
  id: number;
  audioMediaItemId: number;
  imageMediaItemId: number | null; // FIXED: was required, should be nullable
  outputMediaItemId: number | null;
  waveformConfig: string | null; // ADDED: was missing
  requestedByUserId?: number | null;
  status: JobStatus;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  audioMediaItem?: MediaItem;
  imageMediaItem?: MediaItem | null;
  outputMediaItem?: MediaItem | null;
  requestedByUser?: {
    id: number;
    email: string;
    name: string | null;
  } | null;
}

// ============================================================================
// API Request Types
// ============================================================================

export interface CreateUploadJobRequest {
  mediaItemId: number;
  youtubeChannelId: number;
  thumbnailMediaItemId?: number;
  title: string;
  description: string;
  tags?: string[];
  privacyStatus: PrivacyStatus;
  scheduledFor?: string;
}

export interface CreateRenderJobRequest {
  // Deprecated fields kept optional for backward compatibility; prefer renderSpec.
  audioMediaItemId?: number;
  imageMediaItemId?: number;
  waveformConfig?: string;
  renderSpec?: RenderSpec;
}
