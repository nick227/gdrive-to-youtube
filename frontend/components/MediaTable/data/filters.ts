import { EnrichedMediaItem, MimeFiltersState, MimeTypeFilter } from './types';

export type { MimeFiltersState, MimeTypeFilter } from './types';

export function createDefaultMimeFilters(): MimeFiltersState {
  return {
    allowed: new Set(['image', 'video', 'audio']),
    showOther: true,
  };
}

export function getMimeTypeCategory(
  mimeType: string | null | undefined
): MimeTypeFilter | 'other' {
  if (!mimeType) return 'other';
  const prefix = mimeType.split('/')[0].toLowerCase();
  if (prefix === 'image' || prefix === 'video' || prefix === 'audio') {
    return prefix as MimeTypeFilter;
  }
  return 'other';
}

export function filterByMimeCategory(
  items: EnrichedMediaItem[],
  filters: MimeFiltersState
): EnrichedMediaItem[] {
  return items.filter(item => {
    const category = item._enriched.mimeCategory;
    if (category === 'other') {
      return filters.showOther;
    }
    return filters.allowed.has(category);
  });
}

export function toggleMimeFilter(
  prev: MimeFiltersState,
  type: MimeTypeFilter
): MimeFiltersState {
  const nextAllowed = new Set(prev.allowed);
  if (nextAllowed.has(type)) {
    const visibleBuckets = nextAllowed.size + (prev.showOther ? 1 : 0);
    if (visibleBuckets > 1) {
      nextAllowed.delete(type);
    }
  } else {
    nextAllowed.add(type);
  }
  return { ...prev, allowed: nextAllowed };
}

export function toggleOtherMime(prev: MimeFiltersState): MimeFiltersState {
  const visibleBuckets = prev.allowed.size + (prev.showOther ? 1 : 0);
  if (prev.showOther && visibleBuckets === 1) {
    return prev;
  }
  return { ...prev, showOther: !prev.showOther };
}
