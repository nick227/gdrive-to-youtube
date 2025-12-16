'use client';

import { useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useMediaDashboard } from '../hooks/useMediaDashboard';
import MediaTable from '../components/MediaTable';
import PendingJobsList from '../components/PendingJobsList';
import QuickUploadModal from '../components/QuickUploadModal';
import CreateVideoModal from '../components/CreateVideoModal';
import { MediaItem, YoutubeChannel } from '../types/api';
import { API_URL } from '../config/api';

export default function Page() {
  const { user, loading: authLoading, login, logout } = useAuth();
  const { media, uploadJobs, renderJobs, channels, loading, error, reload } = useMediaDashboard();
  const [selectedMediaItem, setSelectedMediaItem] = useState<MediaItem | null>(null);
  const [quickUploadOpen, setQuickUploadOpen] = useState(false);
  const [createVideoOpen, setCreateVideoOpen] = useState(false);

  const imageItems = media.filter((m) => m.mimeType.startsWith('image/'));

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

  const openUploadModal = useCallback((item: MediaItem) => {
    if (!user) {
      login();
      return;
    }
    setSelectedMediaItem(item);
    setQuickUploadOpen(true);
  }, [user, login]);

  const openCreateVideoModal = useCallback((item: MediaItem) => {
    if (!user) {
      login();
      return;
    }
    setSelectedMediaItem(item);
    setCreateVideoOpen(true);
  }, [user, login]);

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
        <h1 className="page-title">YouTube Upload Manager</h1>
        <div className='flex flex-nowrap toolbar'>
          <div>
            {user && (
              <div className='mb-2'>
                <a
                  className="btn-link"
                  href={`${API_URL}/channels/auth-url?userId=${user.id}`}
                  target="_blank"
                  rel="noreferrer"
                >Link YouTube Account</a>
              </div>
            )}
            <div>
              {user && channels && (
                <>
                  {channels.map((channel) => (
                    <span className='p-2 bg-amber-50' key={channel.id}>
                      {channel.title ?? channel.channelId}
                    </span>
                  ))}
                </>
              )}
            </div>
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

      {user && (
        <div className="history-panel">
          <PendingJobsList
            uploadJobs={uploadJobs}
            renderJobs={renderJobs}
            onRefresh={reload}
            loading={loading}
          />
        </div>
      )}

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
