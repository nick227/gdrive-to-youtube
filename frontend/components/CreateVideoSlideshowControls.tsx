'use client';

type SlideshowControls = {
  intervalSeconds: number;
  autoTime: boolean;
  repeatImages: boolean;
};

type Props = {
  value: SlideshowControls;
  onChange: (value: SlideshowControls) => void;
};

export default function CreateVideoSlideshowControls({
  value,
  onChange,
}: Props) {
  return (
    <div className="form-field">

      <div className="slideshow-grid mt-4">
        <h6>Interval</h6>
        <label className="flex flex-col gap-1 mt-2">
          <input
            type="number"
            min={1}
            step={1}
            className="form-input"
            disabled={value.autoTime}
            value={value.intervalSeconds}
            onChange={(e) => {
              const raw = e.target.value;
              if (raw === '') return;
              const next = parseInt(raw, 10);
              if (!Number.isNaN(next) && next > 0) {
                onChange({ ...value, intervalSeconds: next });
              }
            }}
          />
          <small className="text-muted">
            Used only when auto-time is disabled.
          </small>
        </label>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={value.autoTime}
            onChange={(e) =>
              onChange({ ...value, autoTime: e.target.checked })
            }
          />
          <span>Auto-time images to audio length</span>
        </label>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={value.repeatImages}
            onChange={(e) =>
              onChange({ ...value, repeatImages: e.target.checked })
            }
          />
          <span>Loop images until audio ends</span>
        </label>
      </div>
    </div>
  );
}
