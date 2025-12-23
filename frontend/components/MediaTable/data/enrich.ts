import { MediaItem, UploadJob } from '../../../types/api';
import { getMediaRowState } from '../../../utils/mediaRowState';
import { getMimeTypeCategory } from './filters';
import { UsageMaps, EnrichedMediaItem, UploadUsageEntry, RenderUsageEntry } from './types';

function normalizePathJoin(
  folderPath: string | null | undefined,
  name: string | null | undefined
): string {
  const fileName = name ?? 'unnamed';

  if (!folderPath || folderPath === '') {
    return fileName;
  }

  if (folderPath === '/') {
    return `/${fileName}`;
  }

  const cleanPath = folderPath.replace(/\/$/, '');
  return `${cleanPath}/${fileName}`;
}

function normalizeFolderPath(folderPath: string | null | undefined): string {
  const raw = folderPath?.trim();
  if (!raw) return '/';
  if (raw === '/') return '/';
  const normalized = raw.replace(/\\+/g, '/').replace(/\/+$/, '');
  return normalized.startsWith('/') ? normalized : `/${normalized}`;
}

function deriveCompactStatusFromUsage(usage: EnrichedMediaItem['_enriched']['usage']): string {
  const count =
    (usage.renderAudioCount ?? 0) +
    (usage.renderImageCount ?? 0) +
    (usage.renderOutputCount ?? 0);

  if (!usage.latestRenderStatus || count === 0) return '';
  return `${usage.latestRenderStatus} ${count}`;
}

function deriveUsage(
  mediaId: number | null | undefined,
  uploadUsage: Map<number, UploadUsageEntry>,
  renderUsage: Map<number, RenderUsageEntry>
) {
  if (mediaId == null) {
    return {
      uploadCount: 0,
      latestUploadStatus: null,
      renderAudioCount: 0,
      renderImageCount: 0,
      renderOutputCount: 0,
      latestRenderStatus: null,
    };
  }

  const upload = uploadUsage.get(mediaId);
  const render = renderUsage.get(mediaId);

  return {
    uploadCount: upload?.count ?? 0,
    latestUploadStatus: upload?.latestStatus ?? null,
    renderAudioCount: render?.audioCount ?? 0,
    renderImageCount: render?.imageCount ?? 0,
    renderOutputCount: render?.outputCount ?? 0,
    latestRenderStatus: render?.latestStatus ?? null,
  };
}

export function enrichMediaItem(
  item: MediaItem,
  usageMaps: UsageMaps,
  uploadJobs: UploadJob[]
): EnrichedMediaItem {
  const state = getMediaRowState(item, uploadJobs);
  const mimeCategory = getMimeTypeCategory(item.mimeType);

  const parsedSize = Number(item.sizeBytes);
  const sizeNum = Number.isFinite(parsedSize) ? parsedSize : 0;

  const createdAtTimeRaw = item.createdAt ? Date.parse(item.createdAt) : NaN;
  const createdAtTime = Number.isFinite(createdAtTimeRaw) ? createdAtTimeRaw : 0;
  const formattedDate = createdAtTime ? new Date(createdAtTime).toLocaleDateString('en-US') : '—';

  const fullPath = normalizePathJoin(item.folderPath, item.name);
  const directoryPath = normalizeFolderPath(item.folderPath);

  const stableKey =
    item.driveFileId
      ? `drive-${item.driveFileId}`
      : item.id != null
        ? String(item.id)
        : `${item.folderPath ?? 'none'}/${item.name ?? 'unnamed'}::${createdAtTime}::${sizeNum}::${item.mimeType ?? 'unknown'}`;

  const usage = deriveUsage(item.id, usageMaps.uploadUsage, usageMaps.renderUsage);
  const compactStatus = deriveCompactStatusFromUsage(usage);

  return {
    ...item,
    _enriched: {
      state,
      mimeCategory,
      sizeNum,
      createdAtTime,
      formattedDate,
      fullPath,
      directoryPath,
      stableKey,
      usage,
      compactStatus,
    },
  };
}

export function enrichMediaItems(
  media: MediaItem[],
  usageMaps: UsageMaps,
  uploadJobs: UploadJob[]
): EnrichedMediaItem[] {
  if (!media || media.length === 0) return [];
  return media.map(item => enrichMediaItem(item, usageMaps, uploadJobs));
}
