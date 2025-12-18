import { API_URL } from '../../../config/api';
import { buildPreviewUrl } from '../../../config/mediaPreview';
import { MediaRowState } from '../../../utils/mediaRowState';
import { MimeTypeFilter } from '../data/filters';
import { EnrichedMediaItem } from '../data/types';
import { MediaItem } from '../../../types/api';

export type MediaRowActions = {
  mediaId?: number | null;
  mediaItem?: MediaItem;
  canCancel: boolean;
  jobId?: number | null;
  canPost: boolean;
  canRender: boolean;
};

export type MediaRow = {
  key: string;
  mime: MimeTypeFilter | 'other';
  previewSrc?: string;
  path: string;
  name: string;
  sizeBytes: number;
  createdAt: number;
  mimeType: string;
  state: MediaRowState;
  stateLabel: string;
  stateSeverity: 'neutral' | 'info' | 'warning' | 'error' | 'success';
  compactStatus: string;
  error?: string | null;
  actions: MediaRowActions;
};

function mapStateLabel(kind: MediaRowState['kind']): { label: string; severity: MediaRow['stateSeverity'] } {
  switch (kind) {
    case 'pending':
    case 'scheduled':
    case 'running':
      return { label: 'In progress', severity: 'info' };
    case 'failed':
      return { label: 'Failed', severity: 'error' };
    case 'missing':
      return { label: 'Missing', severity: 'warning' };
    case 'success':
      return { label: 'Complete', severity: 'success' };
    default:
      return { label: 'Idle', severity: 'neutral' };
  }
}

export function toMediaRow(item: EnrichedMediaItem): MediaRow {
  const category = item._enriched.mimeCategory;
  const state = item._enriched.state;
  const previewSrc =
    item.driveFileId && category !== 'other'
      ? buildPreviewUrl(API_URL, item.driveFileId, category)
      : undefined;

  const { label, severity } = mapStateLabel(state.kind);

  return {
    key: item._enriched.stableKey,
    mime: category,
    previewSrc,
    name: item.name ?? 'unnamed',
    path: item._enriched.fullPath,
    sizeBytes: item._enriched.sizeNum,
    createdAt: item._enriched.createdAtTime,
    mimeType: item.mimeType ?? '',
    state,
    stateLabel: label,
    stateSeverity: severity,
    compactStatus: item._enriched.compactStatus,
    error: state.kind === 'failed' ? state.job?.errorMessage ?? null : null,
    actions: {
      mediaId: item.id,
      mediaItem: item,
      canCancel:
        state.kind === 'pending' || state.kind === 'scheduled' || state.kind === 'running',
      jobId: state.job?.id,
      canPost: category === 'video',
      canRender: category === 'audio' || category === 'image',
    },
  };
}
