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
  const [selectedImageId, setSelectedImageId] = useState<number | null>(null);

  // Reset form when modal opens with new media item
  useEffect(() => {
    if (isOpen && mediaItem) {
      setFormData({
        mediaItemId: mediaItem.id,
        youtubeChannelId: channels[0]?.id || 0,
        thumbnailMediaItemId: imageItems[0]?.id ?? null,
        title: mediaItem.name.replace(/\.[^/.]+$/, ''),
        description: '',
        tags: '',
        privacyStatus: 'PUBLIC',
        scheduledFor: '',
      });
      setScheduleEnabled(false);
      setError(null);
      setSelectedImageId(imageItems[0]?.id ?? null);
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
  
  // Keep form thumbnail in sync with selection list
  useEffect(() => {
    if (!isOpen) return;
    if (imageItems.length === 0) {
      setSelectedImageId(null);
      setFormData((prev) => ({ ...prev, thumbnailMediaItemId: undefined }));
      return;
    }
    // If current selection is missing, default to first
    const exists = selectedImageId && imageItems.some((img) => img.id === selectedImageId);
    const nextId = exists ? selectedImageId : imageItems[0].id;
    setSelectedImageId(nextId);
    setFormData((prev) => ({ ...prev, thumbnailMediaItemId: nextId ?? undefined }));
  }, [isOpen, imageItems, selectedImageId]);

  const selectedImage = selectedImageId
    ? imageItems.find((img) => img.id === selectedImageId) ?? null
    : null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Post to YouTube">
      {mediaItem && (
        <form onSubmit={handleSubmit}>
          <div className="form-field">
            <label className="form-label">File</label>
            <div className="form-readonly">{mediaItem.name}</div>
          </div>

          <div className="form-field">
            <label className="form-label">Channel *</label>
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
            <label>Thumbnail</label>
            {imageItems.length === 0 ? (
              <div className="alert alert-warning" style={{ marginBottom: 0 }}>
                No images available. Upload images to Drive first.
              </div>
            ) : (
              <>
                <select
                  className="form-select"
                  value={selectedImageId ?? ''}
                  onChange={(e) =>
                    setSelectedImageId(
                      e.target.value ? parseInt(e.target.value, 10) : null
                    )
                  }
                >
                  <option value="">No thumbnail</option>
                  {imageItems.map((img) => (
                    <option key={img.id} value={img.id}>
                      {img.name}
                    </option>
                  ))}
                </select>

                {selectedImage && selectedImage.driveFileId && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`${API_URL}/media-preview/${selectedImage.driveFileId}/image`}
                    alt={selectedImage.name}
                    style={{ maxWidth: '100%', maxHeight: 160, marginTop: 8, borderRadius: 8 }}
                  />
                )}
              </>
            )}

          </div>

          <div className="form-field">
            <label className="form-label">Title *</label>
            <input
              className="form-input"
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Video title"
            />
          </div>

          <div className="form-field">
            <label className="form-label">Description *</label>
            <textarea
              className="form-textarea"
              required
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Video description"
            />
          </div>

          <div className="form-field">
            <label className="form-label">Tags (comma-separated)</label>
            <input
              className="form-input"
              type="text"
              value={formData.tags}
              onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
              placeholder="tag1, tag2, tag3"
            />
          </div>

          <div className="form-field">
            <label className="form-label">Privacy Status *</label>
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

          <div className="form-field">
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

          <div className="modal-actions">
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
