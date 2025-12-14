'use client';

import { MediaItem } from '../types/api';
import { MediaRowState } from '../utils/mediaRowState';
import { MediaCategory, getMimeCategory } from '../config/mediaPreview';

export interface RowActionsProps {
  mediaItem: MediaItem;
  state: MediaRowState;
  onPostToYouTube: () => void;
  onCreateVideo: () => void;
  onCancelJob?: () => void;
}

type IdleActionConfig = {
  label: string;
  handlerKey: 'onPostToYouTube' | 'onCreateVideo';
  icon: React.ReactNode;
};

/**
 * Declarative mapping from media category to the idle-state action.
 * This keeps RowActions small and easy to extend.
 */
const IDLE_ACTIONS_BY_CATEGORY: Record<MediaCategory, IdleActionConfig | null> = {
  video: {
    label: 'Post',
    handlerKey: 'onPostToYouTube',
    icon: <i className="fa-brands fa-youtube" aria-hidden="true" />,
  },
  audio: {
    label: 'Render',
    handlerKey: 'onCreateVideo',
    icon: <i className="fa-solid fa-video" aria-hidden="true" />,
  },
  image: null,
  other: null,
};

export default function RowActions({
  mediaItem,
  onPostToYouTube,
  onCreateVideo,
}: RowActionsProps) {
  const category = getMimeCategory(mediaItem.mimeType);

  // Idle state: show action buttons based on media type
    const config = IDLE_ACTIONS_BY_CATEGORY[category];
    if (!config) {
      return <span className="text-light text-sm"></span>;
    }

    const handler =
      config.handlerKey === 'onPostToYouTube' ? onPostToYouTube : onCreateVideo;

    return (
      <button className="btn btn-secondary btn-sm btn-item" onClick={handler}>
        <span className="me-2">{config.icon}</span>
        {config.label}
      </button>
    );

}
