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
};

/**
 * Declarative mapping from media category to the idle-state action.
 * This keeps RowActions small and easy to extend.
 */
const IDLE_ACTIONS_BY_CATEGORY: Record<MediaCategory, IdleActionConfig | null> = {
  video: { label: 'Post to YouTube', handlerKey: 'onPostToYouTube' },
  audio: { label: 'Create Video', handlerKey: 'onCreateVideo' },
  image: null,
  other: null,
};

export default function RowActions({
  mediaItem,
  state,
  onPostToYouTube,
  onCreateVideo,
  onCancelJob,
}: RowActionsProps) {
  const category = getMimeCategory(mediaItem.mimeType);

  // Idle state: show action buttons based on media type
  if (state.kind === 'idle') {
    const config = IDLE_ACTIONS_BY_CATEGORY[category];
    if (!config) {
      return <span className="text-light text-sm"></span>;
    }

    const handler =
      config.handlerKey === 'onPostToYouTube' ? onPostToYouTube : onCreateVideo;

    return (
      <button className="btn btn-secondary btn-sm btn-item" onClick={handler}>
        {config.label}
      </button>
    );
  }

  // Failed state: show dismiss button
  if (state.kind === 'failed') {
    return onCancelJob ? (
      <button className="btn btn-secondary btn-sm btn-item" onClick={onCancelJob}>
        Dismiss
      </button>
    ) : null;
  }

  // Pending/Scheduled/Running: show cancel button
  return onCancelJob ? (
    <button className="btn btn-secondary btn-sm btn-item" onClick={onCancelJob}>
      Cancel
    </button>
  ) : null;
}
