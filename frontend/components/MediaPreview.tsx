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

  const showImage = () => {
    if (!src) return;

    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.zIndex = '9999';
    overlay.style.cursor = 'pointer';

    const img = document.createElement('img');
    img.src = src;
    img.style.maxWidth = '90vw';
    img.style.maxHeight = '90vh';
    img.style.objectFit = 'contain';

    overlay.appendChild(img);
    document.body.appendChild(overlay);

    overlay.onclick = () => {
      document.body.removeChild(overlay);
    };
  };


  if (category === 'image') {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        onClick={showImage}
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
    return (
      <div className='w-full media-item-audio'>
        <div className='audio-label'>Audio</div>
        <audio controls src={src} />
      </div>
    );
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
