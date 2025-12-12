import { MediaItem, UploadJob } from '../types/api';

export type MediaRowKind = 'idle' | 'scheduled' | 'pending' | 'running' | 'success' | 'failed' | 'missing';

export interface MediaRowState {
  kind: MediaRowKind;
  job: UploadJob | null;
  scheduledTime?: Date;
}

export function getMediaRowState(mediaItem: MediaItem, uploadJobs: UploadJob[]): MediaRowState {
  let latest: UploadJob | null = null;
  let latestTime = -Infinity;

  for (const j of uploadJobs) {
    if (j.mediaItemId !== mediaItem.id) continue;
    const t = Date.parse(j.createdAt);
    if (Number.isFinite(t) && t > latestTime) {
      latestTime = t;
      latest = j;
    }
  }

  if (!latest) return { kind: 'idle', job: null };

  if (latest.status === 'PENDING' && latest.scheduledFor) {
    const scheduledTime = new Date(latest.scheduledFor);
    if (scheduledTime.getTime() > Date.now()) {
      return { kind: 'scheduled', job: latest, scheduledTime };
    }
  }

  const stateMap: Record<UploadJob["status"], MediaRowKind> = {
    PENDING: 'pending',
    RUNNING: 'running',
    SUCCESS: 'success',
    FAILED: 'failed',
    MISSING: 'missing',
  };

  return { kind: stateMap[latest.status] ?? 'idle', job: latest };
}
