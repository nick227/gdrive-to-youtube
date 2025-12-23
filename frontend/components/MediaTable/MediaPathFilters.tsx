type Props = {
  paths: string[];
  selected: Set<string>;
  onToggle: (pathValue: string) => void;
  onSelectAll: () => void;
};

export default function MediaPathFilters({ paths, selected, onToggle, onSelectAll }: Props) {
  if (!paths || paths.length === 0) return null;

  const allSelected = selected.size === paths.length;

  return (
    <div className="flex gap-2 flex-wrap" role="group" aria-label="Path filters">
      <button
        type="button"
        aria-pressed={allSelected}
        className={`btn btn-sm ${allSelected ? 'btn-dark' : 'btn-secondary'}`}
        onClick={onSelectAll}
      >
        all
      </button>
      {paths.map((pathValue) => {
        const active = selected.has(pathValue);
        const label = pathValue === '/' ? '/' : pathValue;
        return (
          <button
            key={pathValue}
            type="button"
            aria-pressed={active}
            className={`btn btn-sm ${active ? 'btn-dark' : 'btn-secondary'}`}
            onClick={() => onToggle(pathValue)}
            title={pathValue}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
