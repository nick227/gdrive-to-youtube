'use client';

import { MediaItem } from '../types/api';
import { API_URL } from '../config/api';
import { buildPreviewUrl, getMimeCategory } from '../config/mediaPreview';

interface MediaPreviewProps {
  item: MediaItem;
}

/**
 * MediaPreview
 * Renders a small inline preview for image / audio / video
 * using Google Drive–backed routes.
 *
 * All URL and category logic is delegated to config/mediaPreview.ts
 * so this component stays focused on rendering.
 */
export default function MediaPreview({ item }: MediaPreviewProps) {
  const driveFileId = item.driveFileId;

  if (!driveFileId) {
    return <span className="text-muted text-xs">No preview</span>;
  }

  const category = getMimeCategory(item.mimeType ?? undefined);
  const src = buildPreviewUrl(API_URL, driveFileId, category);

  if (!src) {
    return <span className="text-muted text-xs">No preview</span>;
  }

  if (category === 'image') {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={item.name}
        style={{
          objectFit: 'contain',
          display: 'block',
        }}
      />
    );
  }

  if (category === 'audio') {
    return <audio controls src={src} style={{ display: 'block' }} />;
  }

  if (category === 'video') {
    return (
      <video
        controls
        src={src}
        style={{
          display: 'block',
        }}
      />
    );
  }

  return <span className="text-muted text-xs">No preview</span>;
}
