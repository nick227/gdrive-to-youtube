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

    const urlMatch = trimmed.match(/\/folders\/([a-zA-Z0-9_-]{10,})/);
    if (urlMatch) return urlMatch[1];

    const idMatch = trimmed.match(/^[a-zA-Z0-9_-]{10,}$/);
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

    const [submitting, setSubmitting] = useState(false);
    const [initialLoading, setInitialLoading] = useState(false);

    const abortRef = useRef<AbortController | null>(null);

    const activeConnection = useMemo(
      () => driveConnections.find((c) => c.id === (driveConnectionIdFromQuery || driveConnections[0]?.id)) ?? null,
      [driveConnections, driveConnectionIdFromQuery]
    );

    const fetchConnections = useCallback(async () => {
      if (!userId) {
        setDriveConnections([]);
        return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

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
          setError('Failed to load Drive connection');
        }
      } finally {
        setInitialLoading(false);
      }
    }, [userId, onRequireAuth]);

    const fetchSharingUsers = useCallback(async () => {
      if (!userId || !activeConnection) {
        setSharingUsers([]);
        return;
      }

      try {
        const res = await fetch(
          `${API_URL}/drive/connections/${activeConnection.id}/users`,
          {
            credentials: 'include',
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
      } catch {
        // Don't block the UI if we fail to load sharing info; just clear and show a subtle note.
        setSharingUsers([]);
        setError(null);
      }
    }, [userId, activeConnection]);

    useEffect(() => {
      fetchConnections();
    }, [fetchConnections]);

    useEffect(() => {
      fetchSharingUsers();

      return () => {
        abortRef.current?.abort();
      };
    }, [fetchSharingUsers]);

    // Refresh after OAuth redirect
    useEffect(() => {
      if (driveConnectionIdFromQuery) {
        fetchConnections();
        onReload();
      }
    }, [driveConnectionIdFromQuery, fetchConnections, onReload]);

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
      <div className="mb-6 p-4 border rounded bg-white shadow-sm">
        <div className="flex justify-between items-center mb-2">
          <h3 className="section-title m-0">Google Drive Link</h3>
          <span className="text-xs text-gray-500">
            Shared library across linked users
          </span>
        </div>

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
            disabled={submitting}
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
                <span className="p-2 mr-2">{u.name || 'Unknown'}</span>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

