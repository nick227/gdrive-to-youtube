import StatusBadge from '../../ui/StatusBadge';
import { MediaRowState } from '../../../utils/mediaRowState';

interface Props {
  state: MediaRowState;
  error?: string | null;
  showBadge?: boolean;
  compactStatus?: string;
}

export default function MediaRowStatus({ state, error, showBadge = false, compactStatus }: Props) {
  if (!showBadge && !error) {
    return null;
  }

  const scheduledTime =
    state.scheduledTime && Number.isFinite(state.scheduledTime.getTime())
      ? state.scheduledTime.toISOString()
      : undefined;

  return (
    <div className="flex items-center px-2 text-xs">
      {showBadge && <StatusBadge status={state.kind} scheduledTime={scheduledTime} />}
      {compactStatus && <span className="text-error">{compactStatus}</span>}
      {error && <span className="text-error">{error}</span>}
    </div>
  );
}
