'use client';

import { MediaItem } from '../types/api';

type Props = {
  availableImages: MediaItem[];
  imageIds: number[];
  onChange: (ids: number[]) => void;
  previewImageId: number | null;
  onPreviewChange: (id: number | null) => void;
  apiUrl: string;
};

export default function CreateVideoImageSequence({
  availableImages,
  imageIds,
  onChange,
  previewImageId,
  onPreviewChange,
  apiUrl,
}: Props) {
  const availableImagesMap = new Map(availableImages.map((img) => [img.id, img]));

  const addImageRow = () => {
    if (availableImages.length === 0) return;
    const fallback = availableImages[0].id;
    onChange([...imageIds, fallback]);
    if (!previewImageId) {
      onPreviewChange(fallback);
    }
  };

  const updateImageAt = (index: number, id: number) => {
    const next = [...imageIds];
    next[index] = id;
    onChange(next);
  };

  const removeImageAt = (index: number) => {
    if (imageIds.length <= 1) return;
    const next = imageIds.filter((_, i) => i !== index);
    onChange(next);
    if (previewImageId && !next.includes(previewImageId)) {
      onPreviewChange(next[0] ?? null);
    }
  };

  return (
    <div className="form-field mt-4">
      <h6>Images</h6>
      {availableImages.length === 0 ? (
        <div className="alert alert-warning" style={{ marginBottom: 0 }}>
          No images available. Upload images to Drive first.
        </div>
      ) : (
        <div className="flex flex-col gap-2 max-h-32 overflow-y-auto">
          {imageIds.map((id, idx) => {
            const img = availableImagesMap.get(id);
            return (
              <div
                key={idx}
                className="flex items-center gap-3 cursor-pointer hover:border-gray-400"
                onClick={() => onPreviewChange(id)}
              >
                <select
                  className="form-select"
                  value={id}
                  onChange={(e) => updateImageAt(idx, parseInt(e.target.value, 10))}
                >
                  {availableImages.map((imgOption) => (
                    <option key={imgOption.id} value={imgOption.id}>
                      {imgOption.name}
                    </option>
                  ))}
                </select>
                {img?.driveFileId && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`${apiUrl}/media-preview/${img.driveFileId}/image`}
                    alt={img.name}
                    style={{ height: 34, width: 34, objectFit: 'cover', borderRadius: 1 }}
                  />
                )}
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={imageIds.length <= 1}
                  onClick={(e) => {
                    e.stopPropagation();
                    removeImageAt(idx);
                  }}
                >
                  x
                </button>
              </div>
            );
          })}
        </div>
      )}
      <div className="flex items-center justify-end mt-2 mb-2">
        <button type="button" className="btn btn-small btn-secondary" onClick={addImageRow}>
          Add +
        </button>
      </div>
    </div>
  );
}
