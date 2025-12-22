'use client';

import { Suspense, useState, useCallback, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';
import { useMediaDashboard } from '../hooks/useMediaDashboard';
import { useScheduleItems } from '../hooks/useScheduleItems';
import { triggerJobQueue, cancelUploadJob } from '../utils/jobActions';
import MediaTable from '../components/MediaTable';
import QuickUploadModal from '../components/QuickUploadModal';
import CreateVideoModal from '../components/CreateVideoModal';
import { AuthOnly } from '../components/AuthOnly';
import { HeaderBar } from '../components/dashboard/HeaderBar';
import { SetupSection } from '../components/dashboard/SetupSection';
import { ScheduleSection } from '../components/dashboard/ScheduleSection';
import { HistorySection } from '../components/dashboard/HistorySection';
import { MediaItem } from '../types/api';

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

  const [modal, setModal] = useState<ModalState>({ type: null });

  const scheduleItems = useScheduleItems(uploadJobs);

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
        await cancelUploadJob(jobId);
        reload();
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

  const handleJobQueue = useCallback(
    async (tasks: string[]) => {
      try {
        await triggerJobQueue(tasks);
        alert(`Triggered: ${tasks.join(', ')}`);
        await reload(); // rehydrate media, history, and schedule in place
      } catch (err) {
        console.error('Job queue trigger failed', err);
        alert(`Failed: ${String(err)}`);
      }
    },
    [reload]
  );

  const handleSyncMedia = () => requireAuth(() => handleJobQueue(['sync']));
  const handleProcessJobs = () =>
    requireAuth(() => handleJobQueue(['uploads', 'renders']));

  if (error) {
    return (
      <main className="page-container">
        <h1 className="text-2xl" title="Youtube Upload Manager">YUM</h1>
        <p className="text-error">{error}</p>
        <button className="btn btn-secondary mt-md" onClick={reload}>
          Retry
        </button>
      </main>
    );
  }

  if (authLoading || loading) {
    return (
      <main className="page-container">
        <div className="animate-pulse rounded bg-slate-100 p-4 text-slate-600">
          Loading dashboard...
        </div>
      </main>
    );
  }

  return (
    <main className="page-container">
      <HeaderBar
        user={user}
        onLogin={login}
        onLogout={logout}
        onSyncMedia={handleSyncMedia}
        onProcessJobs={handleProcessJobs}
      />

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
        <SetupSection
          user={user}
          channels={channels}
          onRequireAuth={login}
          onReload={reload}
          driveConnectionId={searchParams?.get('driveConnectionId')}
        />

        <HistorySection
          uploadJobs={uploadJobs}
          renderJobs={renderJobs}
          onRefresh={reload}
        />

        <ScheduleSection items={scheduleItems} />

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
