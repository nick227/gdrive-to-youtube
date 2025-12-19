import { MediaRow } from './rows/MediaRow';
import MediaRowActions from './rows/MediaRowActions';
import MediaRowMeta from './rows/MediaRowMeta';
import MediaRowPreview from './rows/MediaRowPreview';
import MediaRowStatus from './rows/MediaRowStatus';

interface Props {
  rows: MediaRow[];
  onPostToYouTube: (row: MediaRow) => void;
  onCreateVideo: (row: MediaRow) => void;
  onCancelJob?: (jobId: number) => void;
}

export default function MediaListView({
  rows,
  onPostToYouTube,
  onCreateVideo,
  onCancelJob,
}: Props) {
  return (
    <div className="media-list-body d-flex flex-column gap-2">
      {rows.map(row => (
        <div key={row.key} className={`media-item ${row.mime}`}>
          <MediaRowPreview row={row} />
          <MediaRowMeta path={row.path} compactStatus={row.compactStatus} category={row.mime} />

          <div className="media-item-footer flex justify-end px-4 gap-4 mb-4">
            <MediaRowStatus state={row.state} error={row.error} />
            <MediaRowActions
              row={row}
              onPostToYouTube={onPostToYouTube}
              onCreateVideo={onCreateVideo}
              onCancelJob={onCancelJob}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
