'use client';

import { useState, useEffect } from 'react';
import { MediaItem, RenderJob, UploadJob } from '../../types/api';
import MediaListView from './MediaListView';
import MediaTableView from './MediaTableView';
import MediaToolbar from './MediaToolbar';
import { useMediaTable } from './useMediaTable';
import { MediaRow } from './rows/MediaRow';

export interface MediaTableProps {
  media: MediaItem[];
  uploadJobs: UploadJob[];
  renderJobs: RenderJob[];
  onPostToYouTube: (mediaItem: MediaItem) => void;
  onCreateVideo: (mediaItem: MediaItem) => void;
  onCancelJob?: (jobId: number) => void;
}

type ViewMode = 'list' | 'table';

export default function MediaTable({
  media,
  uploadJobs,
  renderJobs,
  onPostToYouTube,
  onCreateVideo,
  onCancelJob,
}: MediaTableProps) {

  const { rows, sortKey, sortDir, search, mimeFilters, handlers, meta } = useMediaTable({
    media,
    uploadJobs,
    renderJobs,
  });

  const hasFilteredResults = rows.length > 0;
  const VIEW_MODE_KEY = 'media.viewMode';

  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window === 'undefined') return 'list';

    const stored = localStorage.getItem(VIEW_MODE_KEY);
    return stored === 'table' || stored === 'list' ? stored : 'list';
  });

  useEffect(() => {
    localStorage.setItem(VIEW_MODE_KEY, viewMode);
  }, [viewMode]);
  const handlePost = (row: MediaRow) => {
    if (row.actions.mediaItem) onPostToYouTube(row.actions.mediaItem);
  };

  const handleCreate = (row: MediaRow) => {
    if (row.actions.mediaItem) onCreateVideo(row.actions.mediaItem);
  };

  if (!meta.hasMedia) {
    return <p className="text-muted">No media found</p>;
  }

  return (
    <div className="media-list">
      <MediaToolbar
        search={search}
        mimeFilters={mimeFilters}
        sortKey={sortKey}
        sortDir={sortDir}
        viewMode={viewMode}
        handlers={handlers}
        onViewChange={setViewMode}
      />

      {!hasFilteredResults ? (
        <p className="text-muted">No media matches your current filters.</p>
      ) : viewMode === 'list' ? (
        <MediaListView
          rows={rows}
          onPostToYouTube={handlePost}
          onCreateVideo={handleCreate}
          onCancelJob={onCancelJob}
        />
      ) : (
        <MediaTableView
          rows={rows}
          onPostToYouTube={handlePost}
          onCreateVideo={handleCreate}
          onCancelJob={onCancelJob}
        />
      )}
    </div>
  );
}
