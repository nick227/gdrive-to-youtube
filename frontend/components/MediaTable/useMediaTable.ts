import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  togglePath: (pathValue: string) => void;
  selectAllPaths: () => void;
}

export interface UseMediaTableResult {
  rows: MediaRow[];
  sortKey: SortKey;
  sortDir: SortDir;
  search: string;
  mimeFilters: MimeFiltersState;
  pathFilters: { allowed: Set<string> };
  pathOptions: string[];
  handlers: UseMediaTableHandlers;
  meta: {
    hasMedia: boolean;
    filteredEnriched: EnrichedMediaItem[];
  };
}

function filterByDirectoryPath(
  items: EnrichedMediaItem[],
  pathFilters: { allowed: Set<string> }
): EnrichedMediaItem[] {
  if (pathFilters.allowed.size === 0) return items;
  return items.filter(item => pathFilters.allowed.has(item._enriched.directoryPath));
}

function filterAndSort(
  items: EnrichedMediaItem[],
  search: string,
  mimeFilters: MimeFiltersState,
  pathFilters: { allowed: Set<string> },
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
  filtered = filterByDirectoryPath(filtered, pathFilters);
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
  const [pathFilters, setPathFilters] = useState<{ allowed: Set<string> }>({
    allowed: new Set(),
  });

  const usageMaps = useMemo(() => computeUsageMaps(uploadJobs, renderJobs), [uploadJobs, renderJobs]);
  const enrichedMedia = useMemo(
    () => enrichMediaItems(media, usageMaps, uploadJobs),
    [media, usageMaps, uploadJobs]
  );
  const pathOptions = useMemo(() => {
    const unique = new Set<string>();
    for (const item of enrichedMedia) {
      unique.add(item._enriched.directoryPath);
    }
    const sorted = Array.from(unique).sort((a, b) => {
      if (a === '/') return -1;
      if (b === '/') return 1;
      return a.localeCompare(b);
    });
    return sorted;
  }, [enrichedMedia]);
  const prevPathOptions = useRef<string[]>([]);

  useEffect(() => {
    setPathFilters(prev => {
      const nextAllowed = new Set(prev.allowed);
      const prevOptions = prevPathOptions.current;
      const hadAllSelected = prevOptions.length > 0 && prev.allowed.size === prevOptions.length;
      const optionSet = new Set(pathOptions);
      let changed = false;

      for (const pathValue of nextAllowed) {
        if (!optionSet.has(pathValue)) {
          nextAllowed.delete(pathValue);
          changed = true;
        }
      }

      if (hadAllSelected) {
        for (const pathValue of pathOptions) {
          if (!nextAllowed.has(pathValue)) {
            nextAllowed.add(pathValue);
            changed = true;
          }
        }
      } else if (nextAllowed.size === 0 && pathOptions.length > 0) {
        for (const pathValue of pathOptions) {
          nextAllowed.add(pathValue);
        }
        changed = true;
      }

      return changed ? { allowed: nextAllowed } : prev;
    });
    prevPathOptions.current = pathOptions;
  }, [pathOptions]);

  const filteredEnriched = useMemo(
    () => filterAndSort(enrichedMedia, search, mimeFilters, pathFilters, sortKey, sortDir),
    [enrichedMedia, search, mimeFilters, pathFilters, sortKey, sortDir]
  );

  const rows = useMemo(() => filteredEnriched.map(toMediaRow), [filteredEnriched]);

  const handleToggleMimeType = useCallback((type: MimeTypeFilter) => {
    setMimeFilters(prev => toggleMimeFilter(prev, type));
  }, []);

  const handleToggleOtherTypes = useCallback(() => {
    setMimeFilters(prev => toggleOtherMime(prev));
  }, []);

  const handleTogglePath = useCallback((pathValue: string) => {
    setPathFilters(prev => {
      const nextAllowed = new Set(prev.allowed);
      if (nextAllowed.has(pathValue)) {
        if (nextAllowed.size > 1) {
          nextAllowed.delete(pathValue);
        }
      } else {
        nextAllowed.add(pathValue);
      }
      return { allowed: nextAllowed };
    });
  }, []);

  const handleSelectAllPaths = useCallback(() => {
    setPathFilters({ allowed: new Set(pathOptions) });
  }, [pathOptions]);

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
    pathFilters,
    pathOptions,
    handlers: {
      setSearch,
      toggleMimeType: handleToggleMimeType,
      toggleOtherTypes: handleToggleOtherTypes,
      handleSort,
      togglePath: handleTogglePath,
      selectAllPaths: handleSelectAllPaths,
    },
    meta: {
      hasMedia: media && media.length > 0,
      filteredEnriched,
    },
  };
}
