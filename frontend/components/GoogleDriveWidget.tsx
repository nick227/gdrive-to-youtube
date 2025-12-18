import {
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import { API_URL } from '../config/api';

type DriveConnection = {
  id: string;
  rootFolderId: string;
  rootFolderName: string;
};

type UserInfo = {
  id: number;
  email: string;
  name: string | null;
};

type Props = {
  userId: number | null;
  onRequireAuth: () => void;
  onReload: () => void;
  driveConnectionIdFromQuery?: string | null;
};

type FetchError =
  | 'unauthorized'
  | 'forbidden'
  | 'network'
  | 'unknown';


function extractFolderId(input: string): string | null {
  const trimmed = input.trim();

  const urlMatch = trimmed.match(/\/folders\/([a-zA-Z0-9_-]{16,})/);
  if (urlMatch) return urlMatch[1];

  const idMatch = trimmed.match(/^[a-zA-Z0-9_-]{16,}$/);
  if (idMatch) return trimmed;

  return null;
}

function mapFetchError(status?: number): FetchError {
  if (!status) return 'network';
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  return 'unknown';
}

export function GoogleDriveWidget({
  userId,
  onRequireAuth,
  onReload,
  driveConnectionIdFromQuery,
}: Props) {
  const [driveConnections, setDriveConnections] = useState<DriveConnection[]>([]);
  const [sharingUsers, setSharingUsers] = useState<UserInfo[]>([]);
  const [driveFolderInput, setDriveFolderInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [shareWarning, setShareWarning] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);

  const connectionAbortRef = useRef<AbortController | null>(null);
  const shareAbortRef = useRef<AbortController | null>(null);
  const [driveLinkOpen, setDriveLinkOpen] = useState(true);

  const activeConnection = useMemo(() => {
    if (driveConnections.length === 0) return null;
    if (driveConnectionIdFromQuery) {
      const match = driveConnections.find((c) => c.id === driveConnectionIdFromQuery);
      if (match) return match;
    }
    return driveConnections[0];
  }, [driveConnections, driveConnectionIdFromQuery]);

  const fetchConnections = useCallback(async () => {
    if (!userId) {
      setDriveConnections([]);
      return;
    }

    connectionAbortRef.current?.abort();
    const controller = new AbortController();
    connectionAbortRef.current = controller;

    setInitialLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/drive/connections`, {
        credentials: 'include',
        signal: controller.signal,
      });

      if (!res.ok) {
        const type = mapFetchError(res.status);
        if (type === 'unauthorized') onRequireAuth();
        throw type;
      }

      const data = await res.json();
      setDriveConnections(
        Array.isArray(data)
          ? data.map((c: any) => ({
            id: c.id,
            rootFolderId: c.rootFolderId,
            rootFolderName: c.rootFolderName,
          }))
          : []
      );
    } catch (err) {
      if (err !== 'AbortError') {
        setError('Link a drive to continue');
      }
    } finally {
      setInitialLoading(false);
    }
  }, [userId, onRequireAuth]);

  const fetchSharingUsers = useCallback(async () => {
    if (!userId || !activeConnection) {
      setSharingUsers([]);
      setShareWarning(null);
      return;
    }

    shareAbortRef.current?.abort();
    const controller = new AbortController();
    shareAbortRef.current = controller;
    setShareWarning(null);

    try {
      const res = await fetch(
        `${API_URL}/drive/connections/${activeConnection.id}/users`,
        {
          credentials: 'include',
          signal: controller.signal,
        }
      );

      if (!res.ok) throw mapFetchError(res.status);

      const data = await res.json();
      setSharingUsers(
        Array.isArray(data)
          ? data.map((u: any) => ({
            id: u.id,
            email: u.email,
            name: u.name ?? null,
          }))
          : []
      );
    } catch (err) {
      if (err !== 'AbortError') {
        setShareWarning('Could not load linked users');
      }
      setSharingUsers([]);
    }
  }, [userId, activeConnection]);

  useEffect(() => {
    const saved = localStorage.getItem('driveLinkOpen');
    if (saved !== null) setDriveLinkOpen(saved === 'true');
  }, []);

  useEffect(() => {
    localStorage.setItem('driveLinkOpen', String(driveLinkOpen));
  }, [driveLinkOpen]);

  useEffect(() => {
    fetchConnections();
    return () => {
      connectionAbortRef.current?.abort();
    };
  }, [fetchConnections]);

  useEffect(() => {
    fetchSharingUsers();
    return () => {
      shareAbortRef.current?.abort();
    };
  }, [fetchSharingUsers]);

  // Refresh after OAuth redirect
  useEffect(() => {
    if (driveConnectionIdFromQuery) {
      onReload();
    }
  }, [driveConnectionIdFromQuery, onReload]);

  const toggleDriveLink = useCallback(() => {
    setDriveLinkOpen((open) => !open);
  }, []);

  const handleSubmit = useCallback(() => {
    if (!userId) {
      onRequireAuth();
      return;
    }

    const folderId = extractFolderId(driveFolderInput);

    if (!folderId) {
      setError('Invalid Drive folder ID or URL');
      return;
    }

    setError(null);
    setSubmitting(true);

    const params = new URLSearchParams({
      mode: 'redirect',
      requestedFolderId: folderId,
      redirectAfter: '/',
    });

    window.location.href = `${API_URL}/drive/auth-url?${params.toString()}`;
  }, [userId, driveFolderInput, onRequireAuth]);

  return (
    <div className="mb-6">
      <div className="flex justify-between py-4 my-2 rounded bg-slate-50 p-3">
        <h3 className="section-title m-0">Google Drive</h3>
        <i className={`fa-solid fa-chevron-${driveLinkOpen ? 'up' : 'down'} cursor-pointer`} onClick={toggleDriveLink} />
      </div>
      {driveLinkOpen && (
        <>
          <p className="text-sm text-gray-600 mb-2">
            Paste a Drive folder ID or URL to link a shared media library.
          </p>

          {initialLoading && (
            <div className="text-sm text-gray-500 mb-2">
              Loading Drive connection…
            </div>
          )}

          {activeConnection && (
            <div className="mb-3 text-sm">
              <strong>Active folder:</strong>{' '}
              {activeConnection.rootFolderName} ({activeConnection.rootFolderId})
            </div>
          )}

          <div className="flex gap-2">
            <input
              className="input flex-1"
              value={driveFolderInput}
              placeholder="Drive folder ID or URL"
              aria-label="Google Drive folder ID or URL"
              aria-describedby={error ? 'drive-error' : undefined}
              onChange={(e) => setDriveFolderInput(e.target.value)}
              disabled={submitting}
            />
            <button
              className={`btn btn-primary ${submitting ? 'opacity-60 cursor-not-allowed' : ''
                }`}
              onClick={handleSubmit}
              disabled={submitting || !driveFolderInput}
              aria-disabled={submitting}
            >
              {submitting ? 'Redirecting…' : 'Link Drive'}
            </button>
          </div>

          {error && (
            <div
              id="drive-error"
              role="alert"
              className="text-error text-sm mt-2"
            >
              {error}
            </div>
          )}

          <div className="mt-4">
            {sharingUsers.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-1">
                  Linked users:
                </h4>
                {sharingUsers.map((u) => (
                  <span className="p-2 mr-2" key={u.id}>{u.name || 'Unknown'}</span>
                ))}
              </div>
            )}
          </div>
        </>

      )}
    </div>
  );
}
