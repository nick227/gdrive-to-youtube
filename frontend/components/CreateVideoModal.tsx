'use client';

import { useState, useEffect, FormEvent, useMemo } from 'react';
import Modal from './ui/Modal';
import { MediaItem, RenderSpec } from '../types/api';
import { buildRenderJobPayload } from '../utils/payloadBuilders';
import { API_URL } from '../config/api';
import CreateVideoModeToggle from './CreateVideoModeToggle';
import CreateVideoImageSequence from './CreateVideoImageSequence';
import CreateVideoAudioSequence from './CreateVideoAudioSequence';
import CreateVideoSlideshowControls from './CreateVideoSlideshowControls';
import CreateVideoWaveformControls from './CreateVideoWaveformControls';

interface CreateVideoModalProps {
  isOpen: boolean;
  audioItem: MediaItem | null;
  imageItems: MediaItem[];
  initialImageId?: number | null;
  onClose: () => void;
  onSuccess: () => void;
}

type RenderMode = RenderSpec['mode'];

type SlideshowConfig = {
  intervalSeconds: number;
  autoTime: boolean;
  repeatImages: boolean;
};

type WaveformConfig = {
  backgroundColor: string;
  waveColor: string;
  waveStyle: 'line' | 'bars' | 'circle';
};

const defaultSlideshow: SlideshowConfig = {
  intervalSeconds: 5,
  autoTime: true,
  repeatImages: false,
};

const defaultWaveform: WaveformConfig = {
  backgroundColor: '#000000',
  waveColor: '#00ffcc',
  waveStyle: 'bars',
};

export default function CreateVideoModal({
  isOpen,
  audioItem,
  imageItems,
  initialImageId,
  onClose,
  onSuccess,
}: CreateVideoModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<RenderMode>('slideshow');
  const [imageSequence, setImageSequence] = useState<number[]>([]);
  const [audioSequence, setAudioSequence] = useState<number[]>([]);
  const [previewImageId, setPreviewImageId] = useState<number | null>(null);
  const [outputFileName, setOutputFileName] = useState<string>('');
  const [slideshowConfig, setSlideshowConfig] = useState<SlideshowConfig>(defaultSlideshow);
  const [waveformConfig, setWaveformConfig] = useState<WaveformConfig>(defaultWaveform);
  const [availableAudios, setAvailableAudios] = useState<MediaItem[]>([]);

  const dedupById = (items: MediaItem[]) => {
    const seen = new Set<number>();
    return items.filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  };

  // Reset form when modal opens
  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setLoading(false);
    setMode('slideshow');
    setSlideshowConfig(defaultSlideshow);
    setWaveformConfig(defaultWaveform);
    setOutputFileName(audioItem?.name || '');

    const resolvedInitialImageId = initialImageId ?? imageItems[0]?.id ?? null;
    setImageSequence(resolvedInitialImageId ? [resolvedInitialImageId] : []);
    setPreviewImageId(resolvedInitialImageId);

    const initialAudioId = audioItem?.id ?? null;
    setAudioSequence(initialAudioId ? [initialAudioId] : []);
  }, [isOpen, audioItem, imageItems, initialImageId]);

  // Fetch available audios when modal opens
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    const fetchAudios = async () => {
      try {
        const res = await fetch(`${API_URL}/media`, { credentials: 'include' });
        if (!res.ok) return;
        const data: MediaItem[] = await res.json();
        const audioMedia = data.filter((item) => item.mimeType.startsWith('audio/'));
        const merged = dedupById([...(audioItem ? [audioItem] : []), ...audioMedia]);
        if (!cancelled) {
          setAvailableAudios(merged);
          if (merged.length > 0 && audioSequence.length === 0) {
            setAudioSequence([merged[0].id]);
          }
        }
      } catch {
        // swallow fetch errors in UI; keep existing audio choices
      }
    };

    void fetchAudios();
    return () => {
      cancelled = true;
    };
  }, [isOpen, audioItem, audioSequence.length]);

  const previewImage = useMemo(
    () => imageItems.find((img) => img.id === previewImageId) || null,
    [imageItems, previewImageId]
  );

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (audioSequence.length === 0) {
      setError('Please add at least one audio track.');
      return;
    }
    if (mode === 'slideshow' && imageSequence.length === 0) {
      setError('Please add at least one image.');
      return;
    }

    const renderSpec: RenderSpec =
      mode === 'slideshow'
        ? {
          mode: 'slideshow',
          images: imageSequence,
          audios: audioSequence,
          intervalSeconds: slideshowConfig.intervalSeconds,
          autoTime: slideshowConfig.autoTime,
          repeatImages: slideshowConfig.repeatImages,
          outputFileName: outputFileName || undefined,
        }
        : {
          mode: 'waveform',
          audios: audioSequence,
          backgroundColor: waveformConfig.backgroundColor,
          waveColor: waveformConfig.waveColor,
          waveStyle: waveformConfig.waveStyle,
          outputFileName: outputFileName || undefined,
        };

    setError(null);
    setLoading(true);

    try {
      const payload = buildRenderJobPayload({
        renderSpec,
      });

      const res = await fetch(`${API_URL}/render-jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to create render job');
      }

      onSuccess();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to create render job'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Video">
      <form onSubmit={handleSubmit}>
        <h6 className="form-label">File Name</h6>
        <div className="form-field">
          <input
            type="text"
            className="form-input"
            placeholder={audioItem?.name || 'rendered_video'}
            value={outputFileName}
            onChange={(e) => setOutputFileName(e.target.value)}
          />
        </div>

        <CreateVideoModeToggle mode={mode} onChange={setMode} />

        {mode === 'slideshow' && (
          <CreateVideoImageSequence
            availableImages={imageItems}
            imageIds={imageSequence}
            onChange={setImageSequence}
            previewImageId={previewImageId}
            onPreviewChange={setPreviewImageId}
            apiUrl={API_URL}
          />
        )}

        {previewImage && (
          <div className="form-field">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`${API_URL}/media-preview/${previewImage.driveFileId}/image`}
              alt={previewImage.name}
              style={{ maxHeight: 240, objectFit: 'contain' }}
            />
          </div>
        )}

        <CreateVideoAudioSequence
          availableAudios={availableAudios}
          audioIds={audioSequence}
          onChange={setAudioSequence}
          apiUrl={API_URL}
        />

        {mode === 'slideshow' ? (
          <CreateVideoSlideshowControls
            value={slideshowConfig}
            onChange={setSlideshowConfig}
          />
        ) : (
          <CreateVideoWaveformControls
            value={waveformConfig}
            onChange={setWaveformConfig}
          />
        )}

        {error && <div className="alert alert-error">{error}</div>}

        <div className="modal-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
          >
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Creating...' : 'Create Render Job'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
