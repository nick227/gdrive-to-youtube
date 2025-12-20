import { API_URL } from '../../config/api';
import { usePersistedToggle } from '../../hooks/usePersistedToggle';
import type { User } from '../../types/auth';
import type { YoutubeChannel } from '../../types/api';
import { GoogleDriveWidget } from '../GoogleDriveWidget';

interface SetupSectionProps {
  user: User | null;
  channels: YoutubeChannel[];
  onRequireAuth: () => void;
  onReload: () => void;
  driveConnectionId: string | null;
}

export function SetupSection({
  user,
  channels,
  onRequireAuth,
  onReload,
  driveConnectionId,
}: SetupSectionProps) {
  const setup = usePersistedToggle('setupOpen', false);
  const connectedCount = Array.isArray(channels) ? channels.length : 0;

  return (
    <section className="mt-2">
      <div
        onClick={setup.toggle}
        className="flex cursor-pointer justify-between bg-slate-50 p-3"
      >
        <h3 className="section-title m-0">Setup</h3>
        <i className={`fa-solid fa-chevron-${setup.open ? 'up' : 'down'}`} />
      </div>

      {setup.open && (
        <div className="mt-2 rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-3">
            <div className="flex flex-col gap-3">
              <div className="flex items-start justify-between">
                <h4 className="text-base font-semibold text-slate-900">
                  Linked accounts
                </h4>
                <span className="text-xs font-medium text-slate-500">
                  {connectedCount} connected
                </span>
              </div>
              <p className="text-sm text-slate-600">
                Manage the YouTube channels attached to this workspace.
              </p>
              <ul className="space-y-2 text-sm text-slate-800">
                {user &&
                  Array.isArray(channels) &&
                  channels.map(c => (
                    <li
                      key={c.id}
                      className="rounded border border-slate-200 bg-slate-50 px-3 py-2"
                    >
                      {c.title ?? c.channelId}
                    </li>
                  ))}
                {user && Array.isArray(channels) && channels.length === 0 && (
                  <li className="text-slate-500">No channels connected yet.</li>
                )}
              </ul>
              {user && (
                <a
                  className="btn btn-secondary w-fit text-sm"
                  href={`${API_URL}/channels/auth-url?userId=${user.id}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Add channel
                </a>
              )}
            </div>

            <div className="flex flex-col gap-3">
              <h4 className="text-base font-semibold text-slate-900">
                Drive connection
              </h4>
              <p className="text-sm text-slate-600">
                Connect Google Drive to sync assets and speed up uploads.
              </p>
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <GoogleDriveWidget
                  userId={user?.id ?? null}
                  onRequireAuth={onRequireAuth}
                  onReload={onReload}
                  driveConnectionIdFromQuery={driveConnectionId}
                />
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <h4 className="text-base font-semibold text-slate-900">
                Publishing checklist
              </h4>
              <p className="text-sm text-slate-600">
                Keep these steps in mind before scheduling new uploads.
              </p>
              <div className="space-y-2 text-sm text-slate-800">
                <div className="flex items-start gap-2">
                  <i className="fa-solid fa-circle-check text-emerald-500 mt-0.5" />
                  <span>Confirm your YouTube channel connection is active.</span>
                </div>
                <div className="flex items-start gap-2">
                  <i className="fa-solid fa-circle-check text-emerald-500 mt-0.5" />
                  <span>Sync your Google Drive folder so new media is available.</span>
                </div>
                <div className="flex items-start gap-2">
                  <i className="fa-solid fa-circle-check text-emerald-500 mt-0.5" />
                  <span>Review titles, privacy, and schedule times before posting.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
