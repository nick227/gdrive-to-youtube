import { MimeFiltersState, MimeTypeFilter } from './data/filters';
import { SortDir, SortKey } from './data/sort';
import MediaSortControls from './MediaSortControls';
import MediaPathFilters from './MediaPathFilters';

type ViewMode = 'list' | 'table';

interface Props {
  search: string;
  mimeFilters: MimeFiltersState;
  pathFilters: { allowed: Set<string> };
  pathOptions: string[];
  sortKey: SortKey;
  sortDir: SortDir;
  viewMode: ViewMode;
  handlers: {
    setSearch: (value: string) => void;
    toggleMimeType: (type: MimeTypeFilter) => void;
    toggleOtherTypes: () => void;
    handleSort: (key: SortKey) => void;
    togglePath: (pathValue: string) => void;
    selectAllPaths: () => void;
  };
  onViewChange: (mode: ViewMode) => void;
}

export default function MediaToolbar({
  search,
  mimeFilters,
  pathFilters,
  pathOptions,
  sortKey,
  sortDir,
  viewMode,
  handlers,
  onViewChange,
}: Props) {
  return (
    <div
      className="flex align-items-center gap-3 mb-4 flex-wrap"
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

      <div className='flex gap-2'>
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
      </div>
      <MediaPathFilters
        paths={pathOptions}
        selected={pathFilters.allowed}
        onToggle={handlers.togglePath}
        onSelectAll={handlers.selectAllPaths}
      />
      <div className='flex gap-2'>
        <MediaSortControls sortKey={sortKey} sortDir={sortDir} onSort={handlers.handleSort} />
        <button
          type="button"
          className={`btn btn-sm ${viewMode === 'list' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => onViewChange(viewMode === 'list' ? 'table' : 'list')}
        >
          Grid
        </button>
      </div>
    </div>
  );
}
