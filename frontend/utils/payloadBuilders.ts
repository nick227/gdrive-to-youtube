import type {
  CreateUploadJobRequest,
  CreateRenderJobRequest,
  PrivacyStatus,
  RenderSpec,
} from '../types/api';

// ============================================================================
// Form Data Types (UI state before transformation)
// ============================================================================

export interface UploadJobFormData {
  mediaItemId: number;
  youtubeChannelId: number;
  thumbnailMediaItemId?: number | null;
  title: string;
  description: string;
  tags: string; // comma-separated string from input
  privacyStatus: PrivacyStatus;
  scheduledFor: string; // datetime-local string
}

export interface RenderJobFormData {
  renderSpec: RenderSpec;
}

// ============================================================================
// Payload Builders (Form → API Request)
// ============================================================================

export function buildUploadJobPayload(formData: UploadJobFormData): CreateUploadJobRequest {
  return {
    mediaItemId: formData.mediaItemId,
    youtubeChannelId: formData.youtubeChannelId,
    thumbnailMediaItemId: formData.thumbnailMediaItemId || undefined,
    title: formData.title,
    description: formData.description,
    tags: formData.tags ? formData.tags.split(',').map((t) => t.trim()).filter(Boolean) : undefined,
    privacyStatus: formData.privacyStatus,
    scheduledFor: formData.scheduledFor || undefined,
  };
}

export function buildRenderJobPayload(formData: RenderJobFormData): CreateRenderJobRequest {
  return {
    renderSpec: formData.renderSpec,
  };
}
