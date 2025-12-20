import { API_URL } from '../config/api';

export async function triggerJobQueue(tasks: string[]): Promise<void> {
  const res = await fetch(`${API_URL}/job-queue/trigger`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tasks }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${res.status}`);
  }
}

export async function cancelUploadJob(jobId: number): Promise<void> {
  const res = await fetch(`${API_URL}/upload-jobs/${jobId}`, {
    method: 'DELETE',
    credentials: 'include',
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${res.status}`);
  }
}
