import Image from 'next/image';
import type { User } from '../../types/auth';

interface HeaderBarProps {
  user: User | null;
  onLogin: () => void;
  onLogout: () => void;
  onSyncMedia: () => void;
  onProcessJobs: () => void;
  onCreateVideo: () => void;
}

export function HeaderBar({
  user,
  onLogin,
  onLogout,
  onSyncMedia,
  onProcessJobs,
  onCreateVideo,
}: HeaderBarProps) {
  return (
    <div className="section-header mb-4 flex items-center justify-between">
      <h1 className="text-2xl">YUM</h1>

      <div className="flex items-center gap-2">
        {user && (
          <>
          <button
            className='btn btn-primary'
            onClick={onCreateVideo}
          >
            Create new Video
          </button>
            <button className="btn btn-secondary" onClick={onSyncMedia}>
              Sync Media
            </button>
            <button className="btn btn-secondary" onClick={onProcessJobs}>
              Process Jobs
            </button>
          </>
        )}

        {user ? (
          <>
            {user.avatarUrl && (
              <Image
                src={user.avatarUrl}
                alt={user.name ?? user.email}
                width={32}
                height={32}
                className="rounded-full"
              />
            )}
            <button className="btn btn-secondary" onClick={onLogout}>
              Logout
            </button>
          </>
        ) : (
          <button className="btn btn-login" onClick={onLogin}>
            Sign in with Google
          </button>
        )}
      </div>
    </div>
  );
}
