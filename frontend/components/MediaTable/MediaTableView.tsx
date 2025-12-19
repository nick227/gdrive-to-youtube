import { useState } from 'react';
import { formatBytes } from '../../utils/mediaFormat';
import MediaRowActions from './rows/MediaRowActions';
import MediaRowIcon from './rows/MediaRowIcon';
import MediaRowStatus from './rows/MediaRowStatus';
import { MediaRow } from './rows/MediaRow';
import MediaPreviewModal from './MediaPreviewModal';

interface Props {
  rows: MediaRow[];
  onPostToYouTube: (row: MediaRow) => void;
  onCreateVideo: (row: MediaRow) => void;
  onCancelJob?: (jobId: number) => void;
}

function formatDate(value: number): string {
  if (!Number.isFinite(value)) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-US');
}

type ModalState =
  | { type: null }
  | { type: 'preview'; item: MediaRow }
  | { type: 'upload'; item: MediaRow }
  | { type: 'create'; item: MediaRow };

export default function MediaTableView({
  rows,
  onPostToYouTube,
  onCreateVideo,
  onCancelJob,
}: Props) {
  const [modal, setModal] = useState<ModalState>({ type: null });

  function previewMedia(item: MediaRow) {
    setModal({ type: 'preview', item });
  }

  function closeModal() {
    setModal({ type: null });
  }

  return (
    <>
      <div className="media-table-wrapper overflow-x-auto">
        <table className="media-table w-full">
          <thead>
            <tr>
              <th className="text-left">Name</th>
              <th className="text-left">Type</th>
              <th className="text-left">Size</th>
              <th className="text-left">Created</th>
              <th className="text-left">Status</th>
              <th className="text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.key}>
                <td>
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="line-clamp-1" title={row.path}>
                      <a
                        className="text-left hover:underline cursor-pointer"
                        onClick={() => previewMedia(row)}
                      >
                        {row.path}
                      </a>
                    </div>
                  </div>
                </td>

                <td>
                  <MediaRowIcon category={row.mime} /> {row.mimeType}
                </td>

                <td>{formatBytes(row.sizeBytes)}</td>
                <td>{formatDate(row.createdAt)}</td>

                <td>
                  <MediaRowStatus
                    state={row.state}
                    error={row.error}
                    compactStatus={row.compactStatus}
                    showBadge
                  />
                </td>

                <td>
                  <MediaRowActions
                    row={row}
                    onPostToYouTube={onPostToYouTube}
                    onCreateVideo={onCreateVideo}
                    onCancelJob={onCancelJob}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal.type === 'preview' && (
        <MediaPreviewModal
          item={modal.item}
          onClose={closeModal}
        />
      )}
    </>
  );
}
