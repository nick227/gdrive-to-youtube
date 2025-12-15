'use client';

import type { RenderSpec } from '../types/api';

type Props = {
  mode: RenderSpec['mode'];
  onChange: (mode: RenderSpec['mode']) => void;
};

export default function CreateVideoModeToggle({ mode, onChange }: Props) {
  return (
    <div className="form-field mt-4">
      <h6 className="form-label">Mode</h6>
      <div className="flex gap-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="render-mode"
            value="slideshow"
            checked={mode === 'slideshow'}
            onChange={() => onChange('slideshow')}
          />
          <span>Slideshow</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="render-mode"
            value="waveform"
            checked={mode === 'waveform'}
            onChange={() => onChange('waveform')}
          />
          <span>Waveform</span>
        </label>
      </div>
    </div>
  );
}
