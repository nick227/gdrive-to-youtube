'use client';

type WaveformControls = {
  backgroundColor: string;
  waveColor: string;
  waveStyle: 'line' | 'bars' | 'circle';
};

type Props = {
  value: WaveformControls;
  onChange: (value: WaveformControls) => void;
};

export default function CreateVideoWaveformControls({ value, onChange }: Props) {
  return (
    <div className="form-field">
      <h6 className="form-label">Waveform Controls</h6>
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <label className="flex flex-col gap-1">
          <span>Background Color</span>
          <input
            type="color"
            className="form-input"
            value={value.backgroundColor}
            onChange={(e) => onChange({ ...value, backgroundColor: e.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span>Wave Color</span>
          <input
            type="color"
            className="form-input"
            value={value.waveColor}
            onChange={(e) => onChange({ ...value, waveColor: e.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span>Wave Style</span>
          <select
            className="form-select"
            value={value.waveStyle}
            onChange={(e) =>
              onChange({
                ...value,
                waveStyle: e.target.value as WaveformControls['waveStyle'],
              })
            }
          >
            <option value="bars">Bars</option>
            <option value="line">Line</option>
            <option value="circle">Circle</option>
          </select>
        </label>
      </div>
    </div>
  );
}
