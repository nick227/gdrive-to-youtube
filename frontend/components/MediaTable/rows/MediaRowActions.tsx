import { MediaRow } from './MediaRow';

interface Props {
  row: MediaRow;
  onPostToYouTube: (row: MediaRow) => void;
  onCreateVideo: (row: MediaRow) => void;
  onCancelJob?: (jobId: number) => void;
}

export default function MediaRowActions({
  row,
  onPostToYouTube,
  onCreateVideo,
  onCancelJob,
}: Props) {
  const handleCancel = () => {
    if (!onCancelJob || !row.actions.jobId) return;
    onCancelJob(row.actions.jobId);
  };

  return (
    <div className="flex items-center gap-2">
      {row.actions.canCancel && onCancelJob && (
        <button className="btn btn-secondary btn-sm btn-item" onClick={handleCancel}>
          Cancel
        </button>
      )}

      {row.actions.canPost && (
        <button
          className="btn btn-secondary btn-sm btn-item"
          onClick={() => onPostToYouTube(row)}
        >
          <span className="me-2">
            <i className="fa-brands fa-youtube" aria-hidden="true" />
          </span>
          Post
        </button>
      )}

      {row.actions.canRender && (
        <button
          className="btn btn-secondary btn-sm btn-item"
          onClick={() => onCreateVideo(row)}
        >
          <span className="me-2">
            <i className="fa-solid fa-video" aria-hidden="true" />
          </span>
          Render
        </button>
      )}
    </div>
  );
}
