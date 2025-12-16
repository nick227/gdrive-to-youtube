'use client';

import { useState, useEffect, FormEvent, useMemo } from 'react';
import Modal from './ui/Modal';
import { MediaItem, YoutubeChannel } from '../types/api';
import { buildUploadJobPayload, UploadJobFormData } from '../utils/payloadBuilders';
import { API_URL } from '../config/api';
import { useMediaDashboard } from '../hooks/useMediaDashboard';

interface QuickUploadModalProps {
  isOpen: boolean;
  mediaItem: MediaItem | null;
  channels: YoutubeChannel[];
  onClose: () => void;
  onSuccess: () => void;
}

const initialFormData: UploadJobFormData = {
  mediaItemId: 0,
  youtubeChannelId: 0,
  thumbnailMediaItemId: undefined,
  title: '',
  description: '',
  tags: '',
  privacyStatus: 'PUBLIC',
  scheduledFor: '',
};

export default function QuickUploadModal({
  isOpen,
  mediaItem,
  channels,
  onClose,
  onSuccess,
}: QuickUploadModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [formData, setFormData] = useState<UploadJobFormData>(initialFormData);
  const { media } = useMediaDashboard();
  const imageItems = useMemo(
    () => media.filter((m) => (m.mimeType ?? '').startsWith('image/')),
    [media]
  );

  // Reset form when modal opens with new media item
  useEffect(() => {
    if (isOpen && mediaItem) {
      setFormData({
        mediaItemId: mediaItem.id,
        youtubeChannelId: channels[0]?.id || 0,
        thumbnailMediaItemId: undefined,
        title: mediaItem.name.replace(/\.[^/.]+$/, ''),
        description: '',
        tags: '',
        privacyStatus: 'PUBLIC',
        scheduledFor: '',
      });
      setScheduleEnabled(false);
      setError(null);
    }
  }, [isOpen, mediaItem, channels, imageItems]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!mediaItem) return;

    setError(null);
    setLoading(true);

    try {
      const payload = buildUploadJobPayload({
        ...formData,
        scheduledFor: scheduleEnabled ? formData.scheduledFor : '',
      });

      const res = await fetch(`${API_URL}/upload-jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to create upload job');
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create upload job');
    } finally {
      setLoading(false);
    }
  };
  
  const videoSrc = mediaItem?.driveFileId
    ? `${API_URL}/media-preview/${mediaItem.driveFileId}/video`
    : null;

  const selectedImage = formData.thumbnailMediaItemId
    ? imageItems.find((img) => img.id === formData.thumbnailMediaItemId) ?? null
    : null;

  const selectedImageSrc = selectedImage?.driveFileId
    ? `${API_URL}/media-preview/${selectedImage.driveFileId}/image`
    : null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Post to YouTube">
      {mediaItem && (
        <form onSubmit={handleSubmit}>
          <div className="form-field">
            <div className="form-readonly truncate">{mediaItem.name}</div>
          </div>

          <div className="form-field mb-2">
            <select
              className="form-select"
              required
              value={formData.youtubeChannelId}
              onChange={(e) => setFormData({ ...formData, youtubeChannelId: parseInt(e.target.value, 10) })}
            >
              {channels.length === 0 && <option value={0}>No channels available</option>}
              {channels.map((ch) => (
                <option key={ch.id} value={ch.id}>
                  {ch.title || ch.channelId}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            {imageItems.length === 0 ? (
              <div className="alert alert-warning" style={{ marginBottom: 8 }}>
                No images available. Upload images to Drive first.
              </div>
            ) : (
              <select
                className="form-select"
                value={formData.thumbnailMediaItemId ?? ''}
                onChange={(e) => {
                  const next = e.target.value ? parseInt(e.target.value, 10) : undefined;
                  setFormData((prev) => ({ ...prev, thumbnailMediaItemId: next }));
                }}
              >
                <option value="">No thumbnail (use video first frame)</option>
                {imageItems.map((img) => (
                  <option key={img.id} value={img.id}>
                    {img.name}
                  </option>
                ))}
              </select>
            )}

            {/* Preview area: always show video if we have one */}
            {videoSrc && (
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  marginTop: 8,
                  borderRadius: 8,
                  overflow: 'hidden',
                }}
              >
                <video
                  src={videoSrc}
                  controls
                  preload="metadata"
                  style={{ width: '100%', display: 'block', maxHeight: 220 }}
                />

                {/* Overlay thumbnail image (intentionally blocks controls) */}
                {selectedImageSrc && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={selectedImageSrc}
                    alt={selectedImage?.name ?? 'Thumbnail'}
                    style={{
                      position: 'absolute',
                      inset: 0,
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                  />
                )}
              </div>
            )}
          </div>

          <h6 className='mt-2'>Title</h6>
          <div className="form-field">
            <input
              className="form-input"
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Video title"
            />
          </div>

            <h6 className='mt-2'>Description</h6>
          <div className="form-field">
            <textarea
              className="form-textarea"
              required
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Video description"
            />
          </div>

            <h6 className='mt-2'>Tags</h6>
          <div className="form-field">
            <input
              className="form-input"
              type="text"
              value={formData.tags}
              onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
              placeholder="tag1, tag2, tag3"
            />
          </div>

            <h6 className='mt-2'>Status</h6>
          <div className="form-field">
            <select
              className="form-select"
              required
              value={formData.privacyStatus}
              onChange={(e) => setFormData({ ...formData, privacyStatus: e.target.value as 'PUBLIC' | 'UNLISTED' | 'PRIVATE' })}
            >
              <option value="PUBLIC">Public</option>
              <option value="UNLISTED">Unlisted</option>
              <option value="PRIVATE">Private</option>
            </select>
          </div>

          <div className="form-field mt-4">
            <label className="form-checkbox-label">
              <input
                type="checkbox"
                checked={scheduleEnabled}
                onChange={(e) => setScheduleEnabled(e.target.checked)}
              />
              Schedule upload
            </label>
            {scheduleEnabled && (
              <input
                className="form-input mt-sm"
                type="datetime-local"
                value={formData.scheduledFor}
                onChange={(e) => setFormData({ ...formData, scheduledFor: e.target.value })}
                required={scheduleEnabled}
              />
            )}
          </div>

          {error && <div className="alert alert-error">{error}</div>}

          <div className="modal-actions className='mt-2'">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || channels.length === 0}
            >
              {loading ? 'Creating...' : 'Create Upload Job'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
