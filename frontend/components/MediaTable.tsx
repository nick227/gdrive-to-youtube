'use client';

import { useMemo, useState } from 'react';
import { MediaItem, UploadJob } from '../types/api';
import { getMediaRowState } from '../utils/mediaRowState';
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

type SortKey = 'path' | 'name' | 'type' | 'size' | 'status' | 'createdAt' | 'state';
type SortDir = 'asc' | 'desc';

const SORTABLE_COLUMNS: { key: SortKey; label: string }[] = [
  { key: 'name', label: 'File' },
  { key: 'path', label: 'Path' },
  { key: 'createdAt', label: 'Created' },
  { key: 'type', label: 'Type' },
  { key: 'size', label: 'Size' },
  { key: 'status', label: 'Status' },
  { key: 'state', label: 'State' },
];

const DEFAULT_SORT_KEY: SortKey = 'name';
const DEFAULT_SORT_DIR: SortDir = 'asc';

function getSortValue(item: MediaItem, uploadJobs: UploadJob[], key: SortKey): string | number {
  switch (key) {
    case 'path':
      return item.folderPath ?? '';
    case 'name':
      return item.name ?? '';
    case 'type':
      return item.mimeType ?? '';
    case 'status':
      return (item.status as string) ?? '';
    case 'size': {
      const size = item.sizeBytes ? parseInt(item.sizeBytes, 10) || 0 : 0;
      return size;
    }
    case 'createdAt': {
      if (!item.createdAt) return 0;
      const time = new Date(item.createdAt).getTime();
      return Number.isNaN(time) ? 0 : time;
    }
    case 'state': {
      const row = getMediaRowState(item, uploadJobs);
      return row.kind;
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

  // NEW: filtering state
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  if (media.length === 0) {
    return <p className="text-muted">No media yet. Run the Drive sync worker.</p>;
  }

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

  const filteredAndSortedMedia = useMemo(() => {
    let items = [...media];

    // 1) filter by search text (name + path)
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter((item) => {
        const name = (item.name ?? '').toLowerCase();
        const path = (item.folderPath ?? '').toLowerCase();
        const mimeType = (item.mimeType ?? '').toLowerCase();
        return name.includes(q) || path.includes(q) || mimeType.includes(q);
      });
    }

    // 2) filter by status
    if (statusFilter !== 'ALL') {
      items = items.filter((item) => item.status === statusFilter);
    }

    // 3) sort
    items.sort((a, b) => {
      const aVal = getSortValue(a, uploadJobs, sortKey);
      const bVal = getSortValue(b, uploadJobs, sortKey);

      let result: number;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        result = aVal - bVal;
      } else {
        result = compareString(String(aVal), String(bVal));
      }

      return sortDir === 'asc' ? result : -result;
    });

    return items;
  }, [media, uploadJobs, sortKey, sortDir, search, statusFilter]);

  return (
    <div className="media-list">
      {/* Controls: filters + sort */}
        {/* Search */}
        <div className="d-flex align-items-center gap-4">
          <input
            type="text"
            placeholder="Search name or path..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className='mr-4'
          />

        {/* Sort buttons */}
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

      {/* List body */}
      <div className="media-list-body d-flex flex-column gap-2">
        {filteredAndSortedMedia.map((item) => {
          const state = getMediaRowState(item, uploadJobs);

          return (
            <div
              key={item.id}
              className="media-row d-flex justify-content-between align-items-stretch p-2 mb-4"
            >
              {/* Left side: preview + info */}
              <div className="d-flex">
                <div className="media-row-preview">
                  <MediaPreview item={item} />
                </div>

                <div className="media-row-info flex-grow-1">
                  <div
                    className="media-preview-title text-truncate"
                    title={item.name ?? undefined}
                  >
                    <strong>{item.folderPath ?? ''}{item.folderPath === '/' ? '' : '/'}{item.name}</strong>
                  </div>

                  <div className="media-row-meta text-muted text-sm d-flex flex-wrap gap-2">
                    <span>{item.mimeType.split('/')[0] ?? 'Unknown'},</span>
                    <span>{formatBytes(item.sizeBytes)},</span>
                    <span>{item.createdAt ? new Date(item.createdAt).toLocaleString() : '—'}, </span>
                    <StatusBadge
                      status={state.kind}
                      scheduledTime={state.scheduledTime?.toISOString()}
                    />
                    {state.kind === 'failed' && state.job?.errorMessage && (
                      <span className="text-error text-xs">{state.job.errorMessage}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Right side: actions */}
              <div className="media-row-actions d-flex align-items-center">
                {item.status === 'ACTIVE' && (
                  <RowActions
                    mediaItem={item}
                    state={state}
                    onPostToYouTube={() => onPostToYouTube(item)}
                    onCreateVideo={() => onCreateVideo(item)}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
