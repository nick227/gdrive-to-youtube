interface Props {
  path: string;
  compactStatus?: string;
  category?: string;
}

export default function MediaRowMeta({ path, compactStatus, category }: Props) {
  return (
    <div className={`h-20 px-4 py-1 ${category ?? ''}`.trim()}>
      <span title={path} className="min-w-0 line-clamp-3 break-all items-baseline-start">
        {path}
      </span>
      {compactStatus ? (
        <div className="text-xs whitespace-nowrap">{compactStatus}</div>
      ) : (
        <div className="text-xs whitespace-nowrap">&nbsp;</div>
      )}
    </div>
  );
}
