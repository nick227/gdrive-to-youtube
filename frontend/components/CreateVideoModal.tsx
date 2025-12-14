'use client';

import { useState, useEffect, FormEvent } from 'react';
import Modal from './ui/Modal';
import { MediaItem } from '../types/api';
import { buildRenderJobPayload } from '../utils/payloadBuilders';
import { API_URL } from '../config/api';

interface CreateVideoModalProps {
  isOpen: boolean;
  audioItem: MediaItem | null;
  imageItems: MediaItem[];
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreateVideoModal({
  isOpen,
  audioItem,
  imageItems,
  onClose,
  onSuccess,
}: CreateVideoModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedImageId, setSelectedImageId] = useState<number>(0);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen && imageItems.length > 0) {
      setSelectedImageId(imageItems[0].id);
      setError(null);
    }
  }, [isOpen, imageItems]);

  const selectedImage = imageItems.find((img) => img.id === selectedImageId);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!audioItem || !selectedImageId) return;

    setError(null);
    setLoading(true);

    try {
      const payload = buildRenderJobPayload({
        audioMediaItemId: audioItem.id,
        imageMediaItemId: selectedImageId,
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
      {audioItem && (
        <form onSubmit={handleSubmit}>
          {/* Image selection + preview */}
          <div className="form-field">
            <label className="form-label">Background Image *</label>
            {imageItems.length === 0 ? (
              <div className="alert alert-warning" style={{ marginBottom: 0 }}>
                No images available. Upload images to Drive first.
              </div>
            ) : (
              <>
                <select
                  className="form-select"
                  required
                  value={selectedImageId}
                  onChange={(e) =>
                    setSelectedImageId(parseInt(e.target.value, 10))
                  }
                >
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
                    />
                )}
              </>
            )}
          </div>

          {/* Audio preview */}
          <div className="form-field">
            <div className="form-readonly truncate">
              {audioItem.driveFileId && (
                <audio
                  controls
                  src={`${API_URL}/media-preview/${audioItem.driveFileId}/audio`}
                  style={{ display: 'block', marginTop: 8 }}
                />
              )}
              {audioItem.name}
            </div>
          </div>

          {error && <div className="alert alert-error">{error}</div>}

          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || imageItems.length === 0}
            >
              {loading ? 'Creating...' : 'Create Render Job'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
