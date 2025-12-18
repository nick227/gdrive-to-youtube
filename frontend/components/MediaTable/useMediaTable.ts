import { useCallback, useMemo, useState } from 'react';
import { MediaItem, RenderJob, UploadJob } from '../../types/api';
import {
  createDefaultMimeFilters,
  filterByMimeCategory,
  MimeFiltersState,
  MimeTypeFilter,
  toggleMimeFilter,
  toggleOtherMime,
} from './data/filters';
import { enrichMediaItems } from './data/enrich';
import { sortMediaItems, SortDir, SortKey, DEFAULT_SORT_KEY, DEFAULT_SORT_DIR } from './data/sort';
import { EnrichedMediaItem } from './data/types';
import { computeUsageMaps } from './data/usage';
import { MediaRow, toMediaRow } from './rows/MediaRow';

interface UseMediaTableArgs {
  media: MediaItem[];
  uploadJobs: UploadJob[];
  renderJobs: RenderJob[];
}

interface UseMediaTableHandlers {
  setSearch: (value: string) => void;
  toggleMimeType: (type: MimeTypeFilter) => void;
  toggleOtherTypes: () => void;
  handleSort: (key: SortKey) => void;
}

export interface UseMediaTableResult {
  rows: MediaRow[];
  sortKey: SortKey;
  sortDir: SortDir;
  search: string;
  mimeFilters: MimeFiltersState;
  handlers: UseMediaTableHandlers;
  meta: {
    hasMedia: boolean;
    filteredEnriched: EnrichedMediaItem[];
  };
}

function filterAndSort(
  items: EnrichedMediaItem[],
  search: string,
  mimeFilters: MimeFiltersState,
  sortKey: SortKey,
  sortDir: SortDir
): EnrichedMediaItem[] {
  if (items.length === 0) return [];

  let filtered = items;

  if (search.trim()) {
    const q = search.toLowerCase();
    filtered = filtered.filter(item => {
      const { fullPath, compactStatus } = item._enriched;
      return (
        fullPath.toLowerCase().includes(q) ||
        (item.mimeType ?? '').toLowerCase().includes(q) ||
        (item.status ?? '').toLowerCase().includes(q) ||
        item._enriched.state.kind.toLowerCase().includes(q) ||
        (item._enriched.state.job?.errorMessage ?? '').toLowerCase().includes(q) ||
        compactStatus.toLowerCase().includes(q)
      );
    });
  }

  filtered = filterByMimeCategory(filtered, mimeFilters);
  return sortMediaItems(filtered, sortKey, sortDir);
}

export function useMediaTable({
  media,
  uploadJobs,
  renderJobs,
}: UseMediaTableArgs): UseMediaTableResult {
  const [sortKey, setSortKey] = useState<SortKey>(DEFAULT_SORT_KEY);
  const [sortDir, setSortDir] = useState<SortDir>(DEFAULT_SORT_DIR);
  const [search, setSearch] = useState('');
  const [mimeFilters, setMimeFilters] = useState<MimeFiltersState>(createDefaultMimeFilters);

  const usageMaps = useMemo(() => computeUsageMaps(uploadJobs, renderJobs), [uploadJobs, renderJobs]);
  const enrichedMedia = useMemo(
    () => enrichMediaItems(media, usageMaps, uploadJobs),
    [media, usageMaps, uploadJobs]
  );

  const filteredEnriched = useMemo(
    () => filterAndSort(enrichedMedia, search, mimeFilters, sortKey, sortDir),
    [enrichedMedia, search, mimeFilters, sortKey, sortDir]
  );

  const rows = useMemo(() => filteredEnriched.map(toMediaRow), [filteredEnriched]);

  const handleToggleMimeType = useCallback((type: MimeTypeFilter) => {
    setMimeFilters(prev => toggleMimeFilter(prev, type));
  }, []);

  const handleToggleOtherTypes = useCallback(() => {
    setMimeFilters(prev => toggleOtherMime(prev));
  }, []);

  const handleSort = useCallback(
    (key: SortKey) => {
      if (sortKey === key) {
        setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortKey(key);
        setSortDir('asc');
      }
    },
    [sortKey]
  );

  return {
    rows,
    sortKey,
    sortDir,
    search,
    mimeFilters,
    handlers: {
      setSearch,
      toggleMimeType: handleToggleMimeType,
      toggleOtherTypes: handleToggleOtherTypes,
      handleSort,
    },
    meta: {
      hasMedia: media && media.length > 0,
      filteredEnriched,
    },
  };
}
