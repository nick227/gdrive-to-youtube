import MediaPreview from '../MediaPreview';
import { MediaRow } from './MediaRow';

interface Props {
  row: MediaRow;
}

export default function MediaRowPreview({ row }: Props) {
  return (
    <div className="media-item-preview">
      <MediaPreview src={row.previewSrc} category={row.mime} name={row.name} />
    </div>
  );
}
