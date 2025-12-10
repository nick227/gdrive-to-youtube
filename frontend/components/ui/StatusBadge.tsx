type StatusType = 'idle' | 'pending' | 'running' | 'success' | 'failed' | 'scheduled' | 'missing';

interface StatusBadgeProps {
  status: StatusType;
  text?: string;
  scheduledTime?: string;
}

const defaultText: Record<StatusType, string> = {
  idle: 'Idle',
  pending: 'Pending',
  running: 'Uploading…',
  success: 'Uploaded',
  failed: 'Failed',
  scheduled: 'Scheduled',
  missing: 'Missing'
};

function formatScheduledTime(dateStr: string): string {
  const date = new Date(dateStr);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${month}/${day}, ${hours}:${minutes}`;
}

export default function StatusBadge({ status, text, scheduledTime }: StatusBadgeProps) {
  let displayText = text || defaultText[status];

  if (status === 'scheduled' && scheduledTime && !text) {
    displayText = `Scheduled (${formatScheduledTime(scheduledTime)})`;
  }

  return (
    <span className={`badge badge-${status}`}>
      {displayText}
    </span>
  );
}
