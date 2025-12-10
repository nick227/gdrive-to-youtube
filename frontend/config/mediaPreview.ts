export type MediaCategory = 'video' | 'audio' | 'image' | 'other';

/**
 * Determine a high-level media category from a MIME type.
 * Centralized here so all components use the same rules.
 */
export function getMimeCategory(mimeType?: string | null): MediaCategory {
  if (!mimeType) return 'other';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.startsWith('image/')) return 'image';
  return 'other';
}

/**
 * Route segment configuration for the Google Drive–backed preview endpoints.
 * Keeps the URL building logic data-driven and reusable.
 */
const MEDIA_PREVIEW_ROUTE_SEGMENT: Record<MediaCategory, string | null> = {
  image: 'image',
  audio: 'audio',
  video: 'video',
  other: null,
};

/**
 * Build the preview URL for a given media category.
 * Returns null if this category has no preview route.
 */
export function buildPreviewUrl(
  apiBaseUrl: string,
  driveFileId: string,
  category: MediaCategory
): string | null {
  const segment = MEDIA_PREVIEW_ROUTE_SEGMENT[category];
  if (!segment) return null;
  return `${apiBaseUrl}/media-preview/${driveFileId}/${segment}`;
}
