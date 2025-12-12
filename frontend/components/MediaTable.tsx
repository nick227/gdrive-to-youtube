'use client';

import { useMemo, useState } from 'react';
import { MediaItem, UploadJob } from '../types/api';
import { getMediaRowState, MediaRowKind } from '../utils/mediaRowState';
import StatusBadge from './ui/StatusBadge';
import MediaPreview from './MediaPreview';
import RowActions from './RowActions';
import { formatBytes, compareString } from '../utils/mediaFormat';

export interface MediaTableProps {
  media: MediaItem[];
  uploadJobs: UploadJob[];
  onPostToYouTube: (mediaItem: MediaItem) => void;
  onCreateVideo: (mediaItem: MediaItem) => void;
  onCancelJob?: (jobId: number) => void;
}

type SortKey = 'folderPath' | 'name' | 'mimeType' | 'size' | 'status' | 'createdAt' | 'state';
type SortDir = 'asc' | 'desc';
type MimeTypeFilter = 'image' | 'video' | 'audio';

const SORTABLE_COLUMNS: { key: SortKey; label: string }[] = [
  { key: 'name', label: 'File' },
  { key: 'folderPath', label: 'Path' },
  { key: 'createdAt', label: 'Created' },
  { key: 'mimeType', label: 'Type' },
  { key: 'size', label: 'Size' },
  { key: 'status', label: 'Status' },
  { key: 'state', label: 'State' },
];

const DEFAULT_SORT_KEY: SortKey = 'name';
const DEFAULT_SORT_DIR: SortDir = 'asc';

// Define priority order for state sorting (lower = higher priority)
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
  };
}

function enrichMediaItem(item: MediaItem, uploadJobs: UploadJob[]): EnrichedMediaItem {
  const state = getMediaRowState(item, uploadJobs);
  const mimeCategory = getMimeTypeCategory(item.mimeType);
  
  // Parse size - use parseInt for stringified integers from backend
  const sizeNum = item.sizeBytes ? parseInt(item.sizeBytes, 10) || 0 : 0;
  
  // Parse date once - prefer ISO 8601 format from backend
  const createdAtTime = item.createdAt ? new Date(item.createdAt).getTime() : 0;
  const formattedDate = item.createdAt && Number.isFinite(createdAtTime)
    ? new Date(createdAtTime).toLocaleString()
    : '—';
  
  const fullPath = normalizePathJoin(item.folderPath, item.name);
  
  // Stable key with collision-resistant fallback
  const stableKey = String(
    item.id ?? `${item.folderPath ?? 'none'}/${item.name ?? 'unnamed'}::${createdAtTime}::${sizeNum}`
  );

  return {
    ...item,
    _enriched: {
      state,
      mimeCategory,
      sizeNum: Number.isFinite(sizeNum) ? sizeNum : 0,
      createdAtTime: Number.isFinite(createdAtTime) ? createdAtTime : 0,
      formattedDate,
      fullPath,
      stableKey,
    },
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
    default:
      return '';
  }
}

export default function MediaTable({
  media,
  uploadJobs,
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
  const enrichedMedia = useMemo(() => {
    if (!media || media.length === 0) return [];
    return media.map((item) => enrichMediaItem(item, uploadJobs));
  }, [media, uploadJobs]);

  const filteredAndSortedMedia = useMemo(() => {
    if (enrichedMedia.length === 0) return [];

    let items = [...enrichedMedia];

    // 1) filter by search text - use the enriched fullPath for consistency
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter((item) => {
        const fullPath = item._enriched.fullPath.toLowerCase();
        const mimeType = (item.mimeType ?? '').toLowerCase();
        return fullPath.includes(q) || mimeType.includes(q);
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

      let result =
        typeof aVal === 'number' && typeof bVal === 'number'
          ? aVal - bVal
          : compareString(String(aVal), String(bVal));

      // Apply sort direction
      result = sortDir === 'asc' ? result : -result;

      // Tie-breaker: use stable key for deterministic ordering
      if (result === 0) {
        const tieBreak = compareString(
          a._enriched.stableKey,
          b._enriched.stableKey
        );
        return sortDir === 'asc' ? tieBreak : -tieBreak;
      }

      return result;
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
      <div className="d-flex flex-column gap-3">
        {/* Search and MIME type filters */}
        <div className="d-flex align-items-center gap-3">
          <input
            type="text"
            placeholder="Search name or path..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mr-4"
          />

          <div className="d-flex gap-2">
            {(['image', 'video', 'audio'] as MimeTypeFilter[]).map((type) => (
              <button
                key={type}
                type="button"
                className={`btn btn-sm ${
                  mimeFilters.allowed.has(type) ? 'btn-primary' : 'btn-outline-secondary'
                }`}
                onClick={() => toggleMimeType(type)}
              >
                {type}
              </button>
            ))}
            <button
              type="button"
              className={`btn btn-sm ${
                mimeFilters.showOther ? 'btn-primary' : 'btn-outline-secondary'
              }`}
              onClick={toggleOtherTypes}
            >
              other
            </button>
          </div>
        </div>

        {/* Sort buttons */}
        <div className="d-flex align-items-center gap-2 flex-wrap">
          {SORTABLE_COLUMNS.map((col) => (
            <button
              key={col.key}
              type="button"
              className={`btn btn-sm ${
                sortKey === col.key ? 'btn-secondary' : 'btn-outline-secondary'
              }`}
              onClick={() => handleSort(col.key)}
            >
              {col.label}
              {renderSortIndicator(col.key)}
            </button>
          ))}
        </div>
      </div>

      {/* List body */}
      {!hasFilteredResults ? (
        <p className="text-muted">No media matches your current filters.</p>
      ) : (
        <div className="media-list-body d-flex flex-column gap-2">
          {filteredAndSortedMedia.map((item) => {
            const { state, mimeCategory, sizeNum, formattedDate, fullPath, stableKey } =
              item._enriched;

            const jobId = state.job?.id;
            const handleCancel =
              onCancelJob && jobId != null ? () => onCancelJob(jobId) : undefined;

            // Show actions when item is active OR there's a job in progress
            const shouldShowActions = item.status === 'ACTIVE' || state.kind !== 'idle';

            return (
              <div key={stableKey} className={`media-row ${mimeCategory}`}>
                <div className={`media-row-type ${mimeCategory}`}>{mimeCategory}</div>
                <div className="media-row-preview">
                  <MediaPreview item={item} />
                </div>

                <div className="media-preview-title text-truncate" title={fullPath}>
                  <strong>{fullPath}</strong>
                </div>

                <div className="media-row-meta text-muted text-sm d-flex flex-wrap gap-2">
                  <span>{formatBytes(sizeNum)}</span>
                  <span>•</span>
                  <span>{formattedDate}</span>
                  <span>•</span>
                  <StatusBadge
                    status={state.kind}
                    scheduledTime={state.scheduledTime?.toISOString()}
                  />

                  {state.kind === 'failed' && state.job?.errorMessage && (
                    <>
                      <span>•</span>
                      <span className="text-error text-xs">{state.job.errorMessage}</span>
                    </>
                  )}
                </div>

                <div className="media-row-actions">
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
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
