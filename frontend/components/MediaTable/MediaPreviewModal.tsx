'use client';

import MediaPreview from './MediaPreview';
import { MediaRow } from './rows/MediaRow';

interface Props {
  item: MediaRow;
  onClose: () => void;
}

function categoryFromMime(mime?: string): 'image' | 'audio' | 'video' | 'other' {
  if (!mime) return 'other';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('video/')) return 'video';
  return 'other';
}

export default function MediaPreviewModal({ item, onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-2 right-2 px-3 py-1 text-sm bg-black/70 rounded"
        >
          ✕
        </button>

        <div className="w-full h-full flex items-center justify-center">
          <MediaPreview
            src={item.previewSrc}
            name={item.previewSrc}
            category={categoryFromMime(item.mimeType)}
          />
        </div>
      </div>
    </div>
  );
}
