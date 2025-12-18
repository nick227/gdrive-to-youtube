import { RenderJob, UploadJob } from '../../../types/api';
import { RenderUsageEntry, UploadUsageEntry, UsageMaps } from './types';

export function buildUploadUsage(
  uploadJobs: UploadJob[]
): Map<number, UploadUsageEntry> {
  const uploadUsageMap = new Map<number, UploadUsageEntry>();
  for (const job of uploadJobs) {
    if (job.mediaItemId == null) continue;
    const createdMs = Date.parse(job.createdAt);
    if (!Number.isFinite(createdMs)) continue;
    const entry = uploadUsageMap.get(job.mediaItemId) ?? {
      count: 0,
      latestStatus: null,
      latestTime: -1,
    };
    entry.count += 1;
    if (createdMs > entry.latestTime) {
      entry.latestTime = createdMs;
      entry.latestStatus = job.status;
    }
    uploadUsageMap.set(job.mediaItemId, entry);
  }
  return uploadUsageMap;
}

export function buildRenderUsage(
  renderJobs: RenderJob[]
): Map<number, RenderUsageEntry> {
  const renderUsageMap = new Map<number, RenderUsageEntry>();
  for (const job of renderJobs) {
    const createdMs = Date.parse(job.createdAt);
    if (!Number.isFinite(createdMs)) continue;
    const roles: Array<{ key: 'audio' | 'image' | 'output'; id: number | null | undefined }> = [
      { key: 'audio', id: job.audioMediaItemId },
      { key: 'image', id: job.imageMediaItemId },
      { key: 'output', id: job.outputMediaItemId },
    ];

    const seenForJob = new Set<number>();
    const seenPerRole = new Set<string>();
    for (const role of roles) {
      if (role.id == null) continue;
      const roleKey = `${role.id}-${role.key}`;
      const entry =
        renderUsageMap.get(role.id) ?? {
          audioCount: 0,
          imageCount: 0,
          outputCount: 0,
          latestStatus: null,
          latestTime: -1,
        };

      if (!seenPerRole.has(roleKey)) {
        if (role.key === 'audio') entry.audioCount += 1;
        if (role.key === 'image') entry.imageCount += 1;
        if (role.key === 'output') entry.outputCount += 1;
        seenPerRole.add(roleKey);
      }

      if (!seenForJob.has(role.id)) {
        if (createdMs > entry.latestTime) {
          entry.latestTime = createdMs;
          entry.latestStatus = job.status;
        }
        seenForJob.add(role.id);
      }

      renderUsageMap.set(role.id, entry);
    }
  }
  return renderUsageMap;
}

export function computeUsageMaps(uploadJobs: UploadJob[], renderJobs: RenderJob[]): UsageMaps {
  return {
    uploadUsage: buildUploadUsage(uploadJobs),
    renderUsage: buildRenderUsage(renderJobs),
  };
}
