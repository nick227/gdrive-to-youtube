'use client';

type MediaCategory = 'image' | 'audio' | 'video' | 'other';

interface MediaPreviewProps {
  src?: string;
  category: MediaCategory;
  name?: string;
}

let activeMedia: HTMLMediaElement | null = null;

function handlePlay(el: HTMLMediaElement) {
  if (activeMedia && activeMedia !== el) {
    activeMedia.pause();
  }
  activeMedia = el;
}

// Renders a small inline preview for image / audio / video using Drive-backed routes.
export default function MediaPreview({ src, category, name }: MediaPreviewProps) {
  if (!src || category === 'other') {
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
        alt={name ?? 'preview'}
        style={{
          objectFit: 'contain',
          display: 'block',
        }}
      />
    );
  }

  if (category === 'audio') {
    return (
      <div className="w-full media-item-audio">
        <audio controls src={src} onPlay={e => handlePlay(e.currentTarget)} />
      </div>
    );
  }

  if (category === 'video') {
    return (
      <video
        controls
        src={src}
        onPlay={e => handlePlay(e.currentTarget)}
        style={{
          display: 'block',
        }}
      />
    );
  }

  return <span className="text-muted text-xs">No preview</span>;
}
