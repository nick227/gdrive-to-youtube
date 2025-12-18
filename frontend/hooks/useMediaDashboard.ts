'use client';

import { useState, useEffect, useCallback } from 'react';
import { MediaItem, UploadJob, RenderJob, YoutubeChannel } from '../types/api';
import { API_URL } from '../config/api';

interface MediaDashboardState {
  media: MediaItem[];
  uploadJobs: UploadJob[];
  renderJobs: RenderJob[];
  channels: YoutubeChannel[];
  loading: boolean;
  error: string | null;
}

export function useMediaDashboard() {
  const [state, setState] = useState<MediaDashboardState>({
    media: [],
    uploadJobs: [],
    renderJobs: [],
    channels: [],
    loading: true,
    error: null,
  });

  const loadAll = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const [mediaRes, uploadRes, renderRes, channelsRes] = await Promise.all([
        fetch(`${API_URL}/media`, { credentials: 'include' }),
        fetch(`${API_URL}/upload-jobs`, { credentials: 'include' }),
        fetch(`${API_URL}/render-jobs`, { credentials: 'include' }),
        fetch(`${API_URL}/channels`),
      ]);

      const [media, uploadJobs, renderJobs, channels] = await Promise.all([
        mediaRes.ok ? mediaRes.json() : [],
        uploadRes.ok ? uploadRes.json() : [],
        renderRes.ok ? renderRes.json() : [],
        channelsRes.ok ? channelsRes.json() : [],
      ]);

      setState((prev) => ({
        ...prev,
        media,
        uploadJobs,
        renderJobs,
        channels,
        loading: false,
        error: null,
      }));
    } catch (err) {
      console.error('Failed to load data:', err);
      setState((prev) => ({
        ...prev,
        loading: false,
        error: 'Failed to load data',
      }));
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  return { ...state, reload: loadAll };
}
