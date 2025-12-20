import { usePersistedToggle } from '../../hooks/usePersistedToggle';
import PendingJobsList from '../PendingJobsList';
import type { RenderJob, UploadJob } from '../../types/api';

interface HistorySectionProps {
  uploadJobs: UploadJob[];
  renderJobs: RenderJob[];
  onRefresh: () => void;
}

export function HistorySection({
  uploadJobs,
  renderJobs,
  onRefresh,
}: HistorySectionProps) {
  const history = usePersistedToggle('historyOpen', false);

  return (
    <PendingJobsList
      uploadJobs={uploadJobs}
      renderJobs={renderJobs}
      onRefresh={onRefresh}
      onToggle={history.toggle}
      isOpen={!history.open}
    />
  );
}
