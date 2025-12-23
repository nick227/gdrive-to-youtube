
import MediaRowIcon from './MediaRowIcon';
import { MimeTypeFilter } from '../data/filters';

interface Props {
  path: string;
  compactStatus?: string;
  category: MimeTypeFilter | 'other';
}

export default function MediaRowMeta({ path, compactStatus, category }: Props) {
  return (
    <div className={`h-10 px-4 py-2 ${category}`.trim()}>
      <span title={path} className="min-w-0 line-clamp-1 break-all items-baseline-start">
        <MediaRowIcon category={category} /> {path}
      </span>
      {compactStatus && (
        <div className="text-xs whitespace-nowrap p-2">{compactStatus}</div>
      )}
    </div>
  );
}
