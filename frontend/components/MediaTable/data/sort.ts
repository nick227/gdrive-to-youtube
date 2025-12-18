import { compareString } from '../../../utils/mediaFormat';
import { MediaRowKind } from '../../../utils/mediaRowState';
import { EnrichedMediaItem } from './types';

export type SortKey =
  | 'folderPath'
  | 'name'
  | 'mimeType'
  | 'size'
  | 'status'
  | 'createdAt'
  | 'state';

export type SortDir = 'asc' | 'desc';

export const SORTABLE_COLUMNS: { key: SortKey; label: string }[] = [
  { key: 'name', label: 'Name' },
  { key: 'folderPath', label: 'Path' },
  { key: 'createdAt', label: 'Created' },
  { key: 'mimeType', label: 'Type' },
  { key: 'size', label: 'Size' },
  { key: 'state', label: 'State' },
];

export const DEFAULT_SORT_KEY: SortKey = 'name';
export const DEFAULT_SORT_DIR: SortDir = 'asc';

const STATE_PRIORITY: Record<MediaRowKind, number> = {
  running: 0,
  pending: 1,
  scheduled: 2,
  failed: 3,
  missing: 4,
  success: 5,
  idle: 6,
};

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

export function sortMediaItems(
  items: EnrichedMediaItem[],
  sortKey: SortKey,
  sortDir: SortDir
): EnrichedMediaItem[] {
  const sorted = [...items];
  sorted.sort((a, b) => {
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
  return sorted;
}
