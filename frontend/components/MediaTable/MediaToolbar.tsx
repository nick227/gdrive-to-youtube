import { MimeFiltersState, MimeTypeFilter } from './data/filters';
import { SortDir, SortKey } from './data/sort';
import MediaSortControls from './MediaSortControls';

type ViewMode = 'list' | 'table';

interface Props {
  search: string;
  mimeFilters: MimeFiltersState;
  sortKey: SortKey;
  sortDir: SortDir;
  viewMode: ViewMode;
  handlers: {
    setSearch: (value: string) => void;
    toggleMimeType: (type: MimeTypeFilter) => void;
    toggleOtherTypes: () => void;
    handleSort: (key: SortKey) => void;
  };
  onViewChange: (mode: ViewMode) => void;
}

export default function MediaToolbar({
  search,
  mimeFilters,
  sortKey,
  sortDir,
  viewMode,
  handlers,
  onViewChange,
}: Props) {
  return (
    <div
      className="flex align-items-center gap-3 mb-4"
      role="toolbar"
      aria-label="Media filters and sorting"
    >
      <input
        type="text"
        placeholder="Search name or path..."
        value={search}
        onChange={e => handlers.setSearch(e.target.value)}
        className="mr-4"
      />

      {(['image', 'video', 'audio'] as MimeTypeFilter[]).map(type => (
        <button
          key={type}
          type="button"
          aria-pressed={mimeFilters.allowed.has(type)}
          className={`btn btn-sm ${mimeFilters.allowed.has(type) ? 'btn-dark' : 'btn-secondary'}`}
          onClick={() => handlers.toggleMimeType(type)}
        >
          {type}
        </button>
      ))}
      <button
        type="button"
        aria-pressed={mimeFilters.showOther}
        className={`btn btn-sm ${mimeFilters.showOther ? 'btn-dark' : 'btn-secondary'}`}
        onClick={handlers.toggleOtherTypes}
      >
        other
      </button>

      <MediaSortControls sortKey={sortKey} sortDir={sortDir} onSort={handlers.handleSort} />

        <button
          type="button"
          className={`btn btn-sm ${viewMode === 'list' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => onViewChange(viewMode === 'list' ? 'table' : 'list')}
        >
          View
        </button>
    </div>
  );
}
