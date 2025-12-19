'use client';

import { Suspense, useState, useCallback, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useMediaDashboard } from '../hooks/useMediaDashboard';
import MediaTable from '../components/MediaTable';
import ScheduleView from '../components/schedule/ScheduleView';
import PendingJobsList from '../components/PendingJobsList';
import QuickUploadModal from '../components/QuickUploadModal';
import CreateVideoModal from '../components/CreateVideoModal';
import { MediaItem, UploadJob } from '../types/api';
import { API_URL } from '../config/api';
import { ScheduleItem } from '../components/schedule/types';
import { useRouter, useSearchParams } from 'next/navigation';
import { GoogleDriveWidget } from '../components/GoogleDriveWidget';
import Image from 'next/image';

/* ----------------------------- helpers ----------------------------- */

function mapUploadJobsToScheduleItems(jobs: UploadJob[]): ScheduleItem[] {
  return jobs
    .filter(j => j.scheduledFor)
    .map(j => {
      const [date, time] = j.scheduledFor!.split('T');
      return {
        id: j.id,
        date,
        time: time?.slice(0, 5),
        title: j.title,
        status: j.youtubeVideo?.status ?? j.status,
        channelTitle: j.youtubeChannel?.title ?? null,
        privacyStatus: j.privacyStatus,
      };
    });
}

function useHydratedToggle(key: string, initial = false) {
  const [open, setOpen] = useState(initial);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = window.localStorage.getItem(key);
    if (raw === 'true' || raw === 'false') {
      setOpen(raw === 'true');
    }
  }, [key]);

  const toggle = useCallback(() => setOpen(v => !v), []);
  return { open, toggle };
}

function usePersistedToggle(key: string, initial = false) {
  const t = useHydratedToggle(key, initial);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(key, String(t.open));
  }, [key, t.open]);

  return t;
}

function AuthOnly({
  user,
  children,
}: {
  user: any;
  children: React.ReactNode;
}) {
  if (!user) return null;
  return <>{children}</>;
}

/* ----------------------------- page ----------------------------- */

type ModalState =
  | { type: null }
  | { type: 'upload'; item: MediaItem }
  | { type: 'create'; item: MediaItem };

function PageContent() {
  const { user, loading: authLoading, login, logout } = useAuth();
  const { media, uploadJobs, renderJobs, channels, loading, error, reload } =
    useMediaDashboard();

  const router = useRouter();
  const searchParams = useSearchParams();

  const history = usePersistedToggle('historyOpen');
  const schedule = usePersistedToggle('scheduleOpen');
  const youtube = usePersistedToggle('youtubeOpen');
  const [aboutOpen, setAboutOpen] = useState(false);

  const [modal, setModal] = useState<ModalState>({ type: null });

  const scheduleItems = useMemo(
    () => mapUploadJobsToScheduleItems(uploadJobs),
    [uploadJobs]
  );

  const imageItems = useMemo(
    () => media.filter(m => m.mimeType.startsWith('image/')),
    [media]
  );

  useEffect(() => {
    const fromDrive = searchParams?.get('driveConnectionId');
    if (fromDrive) {
      void router.replace('/');
      void reload();
    }
  }, [searchParams, reload, router]);

  const requireAuth = useCallback(
    (fn: () => void) => {
      if (!user) {
        login();
        return;
      }
      fn();
    },
    [user, login]
  );

  const handleCancelJob = useCallback(
    async (jobId: number) => {
      try {
        const res = await fetch(`${API_URL}/upload-jobs/${jobId}`, {
          method: 'DELETE',
          credentials: 'include',
        });

        if (res.ok) {
          reload();
        } else {
          const data = await res.json().catch(() => ({}));
          console.error('Failed to cancel job:', data.error);
        }
      } catch (err) {
        console.error('Failed to cancel job:', err);
      }
    },
    [reload]
  );

  const closeModal = () => setModal({ type: null });

  const handleModalSuccess = () => {
    closeModal();
    reload();
  };

  if (authLoading || loading) {
    return (
      <main className="page-container">
        <h1 className="text-2xl">YUM</h1>
      </main>
    );
  }

  if (error) {
    return (
      <main className="page-container">
        <h1 className="text-2xl">YUM</h1>
        <p className="text-error">{error}</p>
        <button className="btn btn-secondary mt-md" onClick={reload}>
          Retry
        </button>
      </main>
    );
  }

  return (
    <main className="page-container">
      {/* Header */}
      <div className="section-header flex justify-between mb-4">
        <h1 className="text-2xl">YUM</h1>

        <div className="flex gap-2 items-center">

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
              <button className="btn btn-secondary" onClick={logout}>
                Logout
              </button>
            </>
          ) : (
            <button className="btn btn-login" onClick={login}>
              Sign in with Google
            </button>
          )}
        </div>
      </div>

      {!user && (
        <div className="alert alert-info mt-4">
          Sign in to create upload jobs and manage videos.
        </div>
      )}

      {user && Array.isArray(channels) && channels.length === 0 && (
        <div className="alert alert-warning">
          No YouTube channels connected
        </div>
      )}

      <AuthOnly user={user}>

        {/* About */}
        <div
          onClick={() => setAboutOpen(v => !v)}
          className="flex justify-between bg-slate-50 p-3 cursor-pointer"
        >
          <h3 className="section-title m-0">About site</h3>
          <i
            className={`fa-solid fa-chevron-${aboutOpen ? 'up' : 'down'}`}
          />
        </div>

        {aboutOpen && (
          <div className="text-center py-6">
            <h2 className="text-9xl">YUM</h2>
            <p className="text-xl my-4">
              Pulls media from Google Drive and uploads to YouTube
            </p>
            <ul className="list-disc list-inside space-y-2 text-xl"> <li className='pb-4'>Sign in with Google</li> <li className='pb-4'>Connect YouTube channel</li> <li className='pb-4'>Link Google Drive</li> <li className='pb-4'>Combine media and render videos</li> <li className='pb-4'>Upload to YouTube</li> </ul>
            <div>

            </div>
          </div>
        )}





        <div
          onClick={youtube.toggle}
          className="flex justify-between bg-slate-50 p-3 mt-2 cursor-pointer"
        >
          <h3 className="section-title m-0">YouTube</h3>
          <i
            className={`fa-solid fa-chevron-${youtube.open ? 'up' : 'down'}`}
          />
        </div>
        {user && youtube.open && (
          <div className="py-6">
            <h3>Linked Accounts:</h3>
            <ul>
              {user &&
                Array.isArray(channels) &&
                channels.map(c => (
                  <li key={c.id}>
                    {c.title ?? c.channelId}
                  </li>
                ))}
            </ul>
            <a
              className="btn-link"
              href={`${API_URL}/channels/auth-url?userId=${user.id}`}
              target="_blank"
              rel="noreferrer"
            >
              Add New +
            </a>
          </div>
        )}

        <GoogleDriveWidget
          userId={user?.id ?? null}
          onRequireAuth={login}
          onReload={reload}
          driveConnectionIdFromQuery={searchParams?.get('driveConnectionId')}
        />

        <div
          onClick={schedule.toggle}
          className="flex justify-between bg-slate-50 p-3 mt-2 cursor-pointer"
        >
          <h3 className="section-title m-0">Schedule</h3>
          <i
            className={`fa-solid fa-chevron-${schedule.open ? 'up' : 'down'}`}
          />
        </div>

        {schedule.open && (
          <div className="mb-8 mt-2">
            <ScheduleView items={scheduleItems} />
          </div>
        )}

        <PendingJobsList
          uploadJobs={uploadJobs}
          renderJobs={renderJobs}
          onRefresh={reload}
          onToggle={history.toggle}
          isOpen={!history.open}
        />

        <div className="my-8">
          <MediaTable
            media={media}
            uploadJobs={uploadJobs}
            renderJobs={renderJobs}
            onPostToYouTube={item =>
              requireAuth(() => setModal({ type: 'upload', item }))
            }
            onCreateVideo={item =>
              requireAuth(() => setModal({ type: 'create', item }))
            }
            onCancelJob={handleCancelJob}
          />
        </div>

        <QuickUploadModal
          isOpen={modal.type === 'upload'}
          mediaItem={modal.type === 'upload' ? modal.item : null}
          channels={channels}
          onClose={closeModal}
          onSuccess={handleModalSuccess}
        />

        <CreateVideoModal
          isOpen={modal.type === 'create'}
          audioItem={
            modal.type === 'create' &&
              modal.item.mimeType.startsWith('audio/')
              ? modal.item
              : null
          }
          initialImageId={
            modal.type === 'create' &&
              modal.item.mimeType.startsWith('image/')
              ? modal.item.id
              : undefined
          }
          imageItems={imageItems}
          onClose={closeModal}
          onSuccess={handleModalSuccess}
        />
      </AuthOnly>

      {!user && <div>Hey everybody</div>}
    </main>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<main className="page-container">Loading...</main>}>
      <PageContent />
    </Suspense>
  );
}
