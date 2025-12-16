'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useMediaDashboard } from '../hooks/useMediaDashboard';
import MediaTable from '../components/MediaTable';
import ScheduleView from '../components/schedule/ScheduleView';
import PendingJobsList from '../components/PendingJobsList';
import QuickUploadModal from '../components/QuickUploadModal';
import CreateVideoModal from '../components/CreateVideoModal';
import { MediaItem } from '../types/api';
import { API_URL } from '../config/api';
import { ScheduleItem } from '../components/schedule/types'
import { UploadJob } from '../types/api'

function mapUploadJobsToScheduleItems(
  jobs: UploadJob[]
): ScheduleItem[] {
  return jobs
    .filter(j => j.scheduledFor) // schedule only
    .map(j => {
      const [date, time] = j.scheduledFor!.split('T')

      return {
        id: j.id,
        date,                         // YYYY-MM-DD
        time: time?.slice(0, 5),      // HH:mm
        title: j.title,
        status: j.youtubeVideo?.status ?? j.status,
        channelTitle: j.youtubeChannel?.title ?? null,
        privacyStatus: j.privacyStatus,
      }
    })
}

const HISTORY_STORAGE_KEY = 'historyOpen';

export default function Page() {
  const { user, loading: authLoading, login, logout } = useAuth();
  const { media, uploadJobs, renderJobs, channels, loading, error, reload } = useMediaDashboard();
  const [selectedMediaItem, setSelectedMediaItem] = useState<MediaItem | null>(null);
  const [quickUploadOpen, setQuickUploadOpen] = useState(false);
  const [createVideoOpen, setCreateVideoOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(true);

  const scheduleItems = useMemo(
  () => mapUploadJobsToScheduleItems(uploadJobs),
  [uploadJobs]
)

  const imageItems = useMemo(
    () => media.filter((m) => m.mimeType.startsWith('image/')),
    [media]
  );

  // Hydrate history toggle from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = window.localStorage.getItem(HISTORY_STORAGE_KEY);
    if (raw === 'true' || raw === 'false') {
      setHistoryOpen(raw === 'true');
    }
  }, []);

  // Persist history toggle to localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(HISTORY_STORAGE_KEY, historyOpen ? 'true' : 'false');
  }, [historyOpen]);

  const handleCancelJob = useCallback(async (jobId: number) => {
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
  }, [reload]);

  const closeModals = useCallback(() => {
    setQuickUploadOpen(false);
    setCreateVideoOpen(false);
    setSelectedMediaItem(null);
  }, []);

  const handleModalSuccess = useCallback(() => {
    closeModals();
    reload();
  }, [closeModals, reload]);

  const requireAuthThen = useCallback(
    (fn: () => void) => {
      if (!user) {
        login();
        return;
      }
      fn();
    },
    [user, login]
  );

  const openUploadModal = useCallback(
    (item: MediaItem) =>
      requireAuthThen(() => {
        setSelectedMediaItem(item);
        setQuickUploadOpen(true);
      }),
    [requireAuthThen]
  );

  const openCreateVideoModal = useCallback(
    (item: MediaItem) =>
      requireAuthThen(() => {
        setSelectedMediaItem(item);
        setCreateVideoOpen(true);
      }),
    [requireAuthThen]
  );

  const toggleHistory = useCallback(() => {
    setHistoryOpen((prev) => !prev);
  }, []);

  if (authLoading || loading) {
    return (
      <main className="page-container">
        <h1 className="page-title">YouTube Upload Manager</h1>
        <p>Loading...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="page-container">
        <h1 className="page-title">YouTube Upload Manager</h1>
        <p className="text-error">{error}</p>
        <button className="btn btn-secondary mt-md" onClick={reload}>
          Retry
        </button>
      </main>
    );
  }

  return (
    <main className="page-container">
      <div className="section-header">
        <h1 className="page-title">Youtube Upload Manager</h1>
        <div className='flex flex-nowrap toolbar'>
          <div>
            {user && (
                <a
                  className="btn-link"
                  href={`${API_URL}/channels/auth-url?userId=${user.id}`}
                  target="_blank"
                  rel="noreferrer"
                >Linked Accounts</a>
            )}
              {user && channels && (
                <>
                  {channels.map((channel) => (
                    <span className='p-2 mx-2 bg-amber-50' key={channel.id}>
                      {channel.title ?? channel.channelId}
                    </span>
                  ))}
                </>
              )}
          </div>  
          {user ? (
            <>
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
        <div className="alert alert-info mt-4 mb-2">
          Sign in to create upload jobs and manage your videos.
        </div>
      )}

      {user && channels.length === 0 && (
        <div className="alert alert-warning">
          No YouTube channels connected
        </div>
      )}

<div className='flex w-full justify-between'>
      {user && (
        <div className="history-panel">
          <PendingJobsList
            uploadJobs={uploadJobs}
            renderJobs={renderJobs}
            onRefresh={reload}
            onToggle={toggleHistory}
            isOpen={historyOpen}
            loading={loading}
          />
        </div>
      )}

      {user && (
        <div className="section-schedule">
          <ScheduleView
            items={scheduleItems}
          />
        </div>
      )}
</div>
      {user && (
        <section className="section">
          <MediaTable
            media={media}
            uploadJobs={uploadJobs}
            renderJobs={renderJobs}
            onPostToYouTube={openUploadModal}
            onCreateVideo={openCreateVideoModal}
            onCancelJob={handleCancelJob}
          />
        </section>
      )}


      {user && (
        <QuickUploadModal
          isOpen={quickUploadOpen}
          mediaItem={selectedMediaItem}
          channels={channels}
          onClose={closeModals}
          onSuccess={handleModalSuccess}
        />
      )}

      {user && (
        <CreateVideoModal
          isOpen={createVideoOpen}
          audioItem={
            selectedMediaItem && selectedMediaItem.mimeType.startsWith('audio/')
              ? selectedMediaItem
              : null
          }
          initialImageId={
            selectedMediaItem && selectedMediaItem.mimeType.startsWith('image/')
              ? selectedMediaItem.id
              : undefined
          }
          imageItems={imageItems}
          onClose={closeModals}
          onSuccess={handleModalSuccess}
        />
      )}

      {!user && (
        <div>
          Hey everybody
        </div>
      )}
    </main>
  );
}
