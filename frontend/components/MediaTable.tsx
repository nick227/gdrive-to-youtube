'use client';

import { useMemo, useState } from 'react';
import { MediaItem, UploadJob, RenderJob } from '../types/api';
import { getMediaRowState, MediaRowKind } from '../utils/mediaRowState';
import StatusBadge from './ui/StatusBadge';
import MediaPreview from './MediaPreview';
import RowActions from './RowActions';
import { formatBytes, compareString } from '../utils/mediaFormat';

export interface MediaTableProps {
  media: MediaItem[];
  uploadJobs: UploadJob[];
  renderJobs: RenderJob[];
  onPostToYouTube: (mediaItem: MediaItem) => void;
  onCreateVideo: (mediaItem: MediaItem) => void;
  onCancelJob?: (jobId: number) => void;
}

type SortKey = 'folderPath' | 'name' | 'mimeType' | 'size' | 'status' | 'createdAt' | 'state';
type SortDir = 'asc' | 'desc';
type MimeTypeFilter = 'image' | 'video' | 'audio';

const SORTABLE_COLUMNS: { key: SortKey; label: string }[] = [
  { key: 'name', label: 'File Name' },
  { key: 'folderPath', label: 'Path' },
  { key: 'createdAt', label: 'Created' },
  { key: 'mimeType', label: 'Type' },
  { key: 'size', label: 'Size' },
  { key: 'status', label: 'Status' },
  { key: 'state', label: 'State' },
];

const DEFAULT_SORT_KEY: SortKey = 'name';
const DEFAULT_SORT_DIR: SortDir = 'asc';

// Define priority order for state sorting (lower = higher priority).
const STATE_PRIORITY: Record<MediaRowKind, number> = {
  running: 0,
  pending: 1,
  scheduled: 2,
  failed: 3,
  missing: 4,
  success: 5,
  idle: 6,
};

function getMimeTypeCategory(mimeType: string | null | undefined): MimeTypeFilter | 'other' {
  if (!mimeType) return 'other';
  const prefix = mimeType.split('/')[0].toLowerCase();
  if (prefix === 'image' || prefix === 'video' || prefix === 'audio') {
    return prefix as MimeTypeFilter;
  }
  return 'other';
}

function normalizePathJoin(folderPath: string | null | undefined, name: string | null | undefined): string {
  const fileName = name ?? 'unnamed';

  if (!folderPath || folderPath === '') {
    // No folder means just the filename (not rooted)
    return fileName;
  }

  if (folderPath === '/') {
    return `/${fileName}`;
  }

  // Remove trailing slash from path and join
  const cleanPath = folderPath.replace(/\/$/, '');
  return `${cleanPath}/${fileName}`;
}

interface EnrichedMediaItem extends MediaItem {
  _enriched: {
    state: ReturnType<typeof getMediaRowState>;
    mimeCategory: MimeTypeFilter | 'other';
    sizeNum: number;
    createdAtTime: number;
    formattedDate: string;
    fullPath: string;
    stableKey: string;
    usage: {
      uploadCount: number;
      latestUploadStatus: string | null;
      renderAudioCount: number;
      renderImageCount: number;
      renderOutputCount: number;
      latestRenderStatus: string | null;
    };
  };
}

type UploadUsageEntry = { count: number; latestStatus: string | null; latestTime: number };
type RenderUsageEntry = {
  audioCount: number;
  imageCount: number;
  outputCount: number;
  latestStatus: string | null;
  latestTime: number;
};

function enrichMediaItem(
  item: MediaItem,
  uploadUsage: Map<number, UploadUsageEntry>,
  renderUsage: Map<number, RenderUsageEntry>,
  uploadJobs: UploadJob[]
): EnrichedMediaItem {
  const state = getMediaRowState(item, uploadJobs);
  const mimeCategory = getMimeTypeCategory(item.mimeType);

  // Parse size - use parseInt for stringified integers from backend
  const parsedSize = Number(item.sizeBytes);
  const sizeNum = Number.isFinite(parsedSize) ? parsedSize : 0;

  // Parse date once - prefer ISO 8601 format from backend
  const createdAtTimeRaw = item.createdAt ? Date.parse(item.createdAt) : NaN;
  const createdAtTime = Number.isFinite(createdAtTimeRaw) ? createdAtTimeRaw : 0;
  const formattedDate = createdAtTime ? new Date(createdAtTime).toLocaleDateString('en-US') : '—';


  const fullPath = normalizePathJoin(item.folderPath, item.name);

  // Stable key with collision-resistant fallback
  const stableKey =
    item.driveFileId
      ? `drive-${item.driveFileId}`
      : item.id != null
        ? String(item.id)
        : `${item.folderPath ?? 'none'}/${item.name ?? 'unnamed'}::${createdAtTime}::${sizeNum}::${item.mimeType ?? 'unknown'}`;

  const usage = deriveUsage(item.id, uploadUsage, renderUsage);

  return {
    ...item,
    _enriched: {
      state,
      mimeCategory,
      sizeNum,
      createdAtTime,
      formattedDate,
      fullPath,
      stableKey,
      usage,
    },
  };
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

function getSortValue(item: EnrichedMediaItem, key: SortKey): string | number {
  switch (key) {
    case 'folderPath':
      return item.folderPath ?? '';
    case 'name':
      return item.name ?? '';
    case 'mimeType':
      return item.mimeType ?? '';
    case 'status':
      return String(item.status ?? '');
    case 'size':
      return item._enriched.sizeNum;
    case 'createdAt':
      return item._enriched.createdAtTime;
    case 'state': {
      const kind = item._enriched.state.kind;
      return kind in STATE_PRIORITY
        ? STATE_PRIORITY[kind as keyof typeof STATE_PRIORITY]
        : 999;
    }
    default: {
      const _exhaustive: never = key;
      throw new Error(`Unhandled sort key: ${_exhaustive as string}`);
    }
  }
}

export default function MediaTable({
  media,
  uploadJobs,
  renderJobs,
  onPostToYouTube,
  onCreateVideo,
  onCancelJob,
}: MediaTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>(DEFAULT_SORT_KEY);
  const [sortDir, setSortDir] = useState<SortDir>(DEFAULT_SORT_DIR);
  const [search, setSearch] = useState('');
  // Keep mime-type filters in a single state to avoid stale closures and enforce at least one visible category
  const [mimeFilters, setMimeFilters] = useState<{
    allowed: Set<MimeTypeFilter>;
    showOther: boolean;
  }>({
    allowed: new Set(['image', 'video', 'audio']),
    showOther: true,
  });

  const toggleMimeType = (type: MimeTypeFilter) => {
    setMimeFilters((prev) => {
      const nextAllowed = new Set(prev.allowed);
      if (nextAllowed.has(type)) {
        // Prevent turning off the last visible bucket (count other as one bucket if enabled)
        const visibleBuckets = nextAllowed.size + (prev.showOther ? 1 : 0);
        if (visibleBuckets > 1) {
          nextAllowed.delete(type);
        }
      } else {
        nextAllowed.add(type);
      }
      return { ...prev, allowed: nextAllowed };
    });
  };

  const toggleOtherTypes = () => {
    setMimeFilters((prev) => {
      // Prevent turning off "other" if it is the only visible bucket
      const visibleBuckets = prev.allowed.size + (prev.showOther ? 1 : 0);
      if (prev.showOther && visibleBuckets === 1) {
        return prev;
      }
      return { ...prev, showOther: !prev.showOther };
    });
  };

  // Memoize enrichment separately to avoid recomputing on every filter/search change
  const { uploadUsage, renderUsage } = useMemo(() => {
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

    const renderUsageMap = new Map<number, RenderUsageEntry>();
    for (const job of renderJobs) {
      const createdMs = Date.parse(job.createdAt);
      if (!Number.isFinite(createdMs)) continue;
      const roles: Array<{ key: 'audio' | 'image' | 'output'; id: number | null | undefined }> = [
        { key: 'audio', id: job.audioMediaItemId },
        { key: 'image', id: job.imageMediaItemId },
        { key: 'output', id: job.outputMediaItemId },
      ];

      const seenForJob = new Set<number>(); // track per media id for latest status
      const seenPerRole = new Set<string>(); // track per media id + role for counts
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

    return { uploadUsage: uploadUsageMap, renderUsage: renderUsageMap };
  }, [uploadJobs, renderJobs]);

  const enrichedMedia = useMemo(() => {
    if (!media || media.length === 0) return [];
    return media.map((item) => enrichMediaItem(item, uploadUsage, renderUsage, uploadJobs));
  }, [media, uploadUsage, renderUsage, uploadJobs]);

  const filteredAndSortedMedia = useMemo(() => {
    if (enrichedMedia.length === 0) return [];

    let items = [...enrichedMedia];

    // 1) filter by search text - use the enriched fullPath for consistency
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter((item) => {
        const fullPath = item._enriched.fullPath.toLowerCase();
        const mimeType = (item.mimeType ?? '').toLowerCase();
        const statusText = (item.status ?? '').toLowerCase();
        const stateKind = item._enriched.state.kind.toLowerCase();
        const err = item._enriched.state.job?.errorMessage?.toLowerCase() ?? '';
        return (
          fullPath.includes(q) ||
          mimeType.includes(q) ||
          statusText.includes(q) ||
          stateKind.includes(q) ||
          err.includes(q)
        );
      });
    }

    // 2) filter by mime type
    items = items.filter((item) => {
      const category = item._enriched.mimeCategory;

      if (category === 'other') {
        return mimeFilters.showOther;
      }

      return mimeFilters.allowed.has(category);
    });

    // 3) sort with stable tie-breaker
    items.sort((a, b) => {
      const aVal = getSortValue(a, sortKey);
      const bVal = getSortValue(b, sortKey);

      const dir = sortDir === 'asc' ? 1 : -1;
      const primary =
        typeof aVal === 'number' && typeof bVal === 'number'
          ? aVal - bVal
          : compareString(String(aVal), String(bVal));

      if (primary !== 0) {
        return dir * primary;
      }

      const tieBreak = compareString(a._enriched.stableKey, b._enriched.stableKey);
      return dir * tieBreak;
    });

    return items;
  }, [enrichedMedia, sortKey, sortDir, search, mimeFilters]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((prevDir) => (prevDir === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const renderSortIndicator = (key: SortKey) => {
    if (sortKey !== key) return null;
    return <span style={{ marginLeft: 6 }}>{sortDir === 'asc' ? '▲' : '▼'}</span>;
  };

  const hasMedia = media && media.length > 0;
  const hasFilteredResults = filteredAndSortedMedia.length > 0;

  if (!hasMedia) {
    return <p className="text-muted">No media yet. Run the Drive sync worker.</p>;
  }

  return (
    <div className="media-list">
      {/* Controls: filters + sort */}
      <div
        className="flex align-items-center gap-3 mb-4"
        role="toolbar"
        aria-label="Media filters and sorting"
      >
        <input
          type="text"
          placeholder="Search name or path..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mr-4"
        />

        {(['image', 'video', 'audio'] as MimeTypeFilter[]).map((type) => (
          <button
            key={type}
            type="button"
            aria-pressed={mimeFilters.allowed.has(type)}
            className={`btn btn-sm ${mimeFilters.allowed.has(type) ? 'btn-dark' : 'btn-secondary'
              }`}
            onClick={() => toggleMimeType(type)}
          >
            {type}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={mimeFilters.showOther}
          className={`btn btn-sm ${mimeFilters.showOther ? 'btn-dark' : 'btn-secondary'
            }`}
          onClick={toggleOtherTypes}
        >
          other
        </button>

        {/* Sort buttons */}
        {SORTABLE_COLUMNS.map((col) => (
          <button
            key={col.key}
            type="button"
            aria-sort={
              sortKey === col.key ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined
            }
            className={`btn btn-sm ${sortKey === col.key ? 'btn-secondary' : 'btn-outline-secondary'
              }`}
            onClick={() => handleSort(col.key)}
          >
            {col.label}
            {renderSortIndicator(col.key)}
          </button>
        ))}
      </div>

      {/* List body */}
      {!hasFilteredResults ? (
        <p className="text-muted">No media matches your current filters.</p>
      ) : (
        <div className="media-list-body d-flex flex-column gap-2">
          {filteredAndSortedMedia.map((item) => {
            const { state, mimeCategory, sizeNum, formattedDate, fullPath, stableKey, usage } =
              item._enriched;

            const jobId = state.job?.id;
            const handleCancel =
              onCancelJob && jobId != null ? () => onCancelJob(jobId) : undefined;

            // Show actions when item is active OR there's a job in progress
            const shouldShowActions = item.status === 'ACTIVE' || state.kind !== 'idle';

            return (
              <div key={stableKey} className={`media-row ${mimeCategory}`}>
                <div className={`flex justify-between items-center media-row-type ${mimeCategory}`}>
                  <div className='flex justify-between items-center'>
                    {mimeCategory === 'other' && <i className="fa-regular fa-question" />}
                    {mimeCategory === 'image' && <i className="fa-regular fa-image" />}
                    {mimeCategory === 'video' && <i className="fa-regular fa-video" />}
                    {mimeCategory === 'audio' && <i className="fa-solid fa-music" />}
                    <span className='pl-2 pr-2'>{mimeCategory}</span>
                  </div>
                  {shouldShowActions && (
                    <RowActions
                      mediaItem={item}
                      state={state}
                      onPostToYouTube={() => onPostToYouTube(item)}
                      onCreateVideo={() => onCreateVideo(item)}
                      onCancelJob={handleCancel}
                    />
                  )}
                </div>
                <div className="media-row-preview">
                  <MediaPreview item={item} />
                </div>

                <div className="media-preview-title truncate" title={fullPath}>
                  <strong>{fullPath}</strong>
                </div>

                <div className="media-row-meta text-muted text-sm d-flex flex-wrap gap-2">
                  <StatusBadge
                    status={state.kind}
                    scheduledTime={
                      state.scheduledTime instanceof Date
                        ? state.scheduledTime.toISOString()
                        : undefined
                    }
                  />

                  {/* conditional usage based on file type */}
                  {mimeCategory === 'video' && (
                    <span className="text-muted text-xs">
                      uploaded: {usage.uploadCount}
                      {usage.latestUploadStatus ? ` (${usage.latestUploadStatus.toLowerCase()})` : ''}
                    </span>
                  )}
                  {mimeCategory === 'audio' && (
                    <span className="text-muted text-xs">
                      used: {usage.renderAudioCount}
                      {usage.latestRenderStatus ? ` (${usage.latestRenderStatus.toLowerCase()})` : ''}
                    </span>
                  )}
                  {mimeCategory === 'image' && (
                    <span className="text-muted text-xs">
                      used: {usage.renderImageCount}
                      {usage.latestRenderStatus ? ` (${usage.latestRenderStatus.toLowerCase()})` : ''}
                    </span>
                  )}

                  {state.kind === 'failed' && state.job && (
                    <span className="text-error text-xs">{state.job.errorMessage}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
