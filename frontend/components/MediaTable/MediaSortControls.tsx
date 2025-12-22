import { SORTABLE_COLUMNS, SortDir, SortKey } from './data/sort';

interface Props {
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
}

export default function MediaSortControls({ sortKey, sortDir, onSort }: Props) {
  const renderSortIndicator = (key: SortKey) => {
    if (sortKey !== key) return null;
    return <span style={{ marginLeft: 6 }}>{sortDir === 'asc' ? '^' : 'v'}</span>;
  };

  return (
    <>
      {SORTABLE_COLUMNS.map(col => (
        <button
          key={col.key}
          type="button"
          aria-sort={sortKey === col.key ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined}
          className={`hide-mobile btn btn-sm ${sortKey === col.key ? 'btn-secondary' : 'btn-outline-secondary'}`}
          onClick={() => onSort(col.key)}
        >
          {col.label}
          {renderSortIndicator(col.key)}
        </button>
      ))}
    </>
  );
}
