'use client';

import { MediaItem } from '../types/api';

type Props = {
  availableAudios: MediaItem[];
  audioIds: number[];
  onChange: (ids: number[]) => void;
  apiUrl: string;
};

export default function CreateVideoAudioSequence({
  availableAudios,
  audioIds,
  onChange,
  apiUrl,
}: Props) {
  const audioMap = new Map(availableAudios.map((a) => [a.id, a]));

  const addAudio = () => {
    if (availableAudios.length === 0) return;
    onChange([...audioIds, availableAudios[0].id]);
  };

  const updateAudioAt = (index: number, id: number) => {
    const next = [...audioIds];
    next[index] = id;
    onChange(next);
  };

  const removeAudioAt = (index: number) => {
    if (audioIds.length <= 1) return;
    onChange(audioIds.filter((_, i) => i !== index));
  };

  return (
    <div className="form-field mt-4">
      <h6>Audio</h6>
      {availableAudios.length === 0 ? (
        <div className="alert alert-warning" style={{ marginBottom: 0 }}>
          No audio files available. Upload audio to Drive first.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {audioIds.map((id, idx) => {
            const audio = audioMap.get(id);
            return (
              <div key={idx} className="p-3 flex flex-col gap-2 max-h-32 overflow-y-auto">
                <div className="flex items-center gap-2">
                  <select
                    className="form-select"
                    value={id}
                    onChange={(e) => updateAudioAt(idx, parseInt(e.target.value, 10))}
                  >
                    {availableAudios.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={audioIds.length <= 1}
                    onClick={() => removeAudioAt(idx)}
                  >
                    x 
                  </button>
                </div>
                {audio?.driveFileId && (
                  <audio
                    controls
                    src={`${apiUrl}/media-preview/${audio.driveFileId}/audio`}
                    style={{ width: '100%' }}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
      <div className="flex items-center justify-end">
        <button type="button" className="btn btn-small btn-secondary" onClick={addAudio}>
          Add +
        </button>
      </div>
    </div>
  );
}
