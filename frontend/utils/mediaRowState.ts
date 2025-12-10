import { MediaItem, UploadJob } from '../types/api';

type MediaRowKind = 'idle' | 'scheduled' | 'pending' | 'running' | 'success' | 'failed' | 'missing';

export interface MediaRowState {
  kind: MediaRowKind;
  job: UploadJob | null;
  scheduledTime?: Date;
}

export function getMediaRowState(
  mediaItem: MediaItem,
  uploadJobs: UploadJob[]
): MediaRowState {
  // Find latest upload job for this media item
  const job = uploadJobs
    .filter((j) => j.mediaItemId === mediaItem.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

  if (!job) {
    return { kind: 'idle', job: null };
  }

  // Check scheduled upload
  if (job.status === 'PENDING' && job.scheduledFor) {
    const scheduledTime = new Date(job.scheduledFor);
    if (scheduledTime > new Date()) {
      return { kind: 'scheduled', job, scheduledTime };
    }
  }

  // Map status to state
  const stateMap: Record<string, MediaRowKind> = {
    PENDING: 'pending',
    RUNNING: 'running',
    SUCCESS: 'success',
    FAILED: 'failed',
    MISSING: 'missing',
  };

  return { kind: stateMap[job.status] || 'idle', job };
}
