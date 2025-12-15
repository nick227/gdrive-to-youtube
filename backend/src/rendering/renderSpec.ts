export type SlideshowRenderSpec = {
  mode: 'slideshow';
  images: number[];
  audios: number[];
  intervalSeconds: number;
  autoTime: boolean;
  repeatImages: boolean;
  outputFileName?: string;
};

export type WaveformRenderSpec = {
  mode: 'waveform';
  audios: number[];
  backgroundColor: string;
  waveColor: string;
  waveStyle: 'line' | 'bars' | 'circle';
  outputFileName?: string;
};

export type RenderSpec = SlideshowRenderSpec | WaveformRenderSpec;

export function normalizeIdList(values: unknown): number[] {
  if (!Array.isArray(values)) return [];
  return Array.from(new Set(values.map((v) => Number(v)).filter((v) => Number.isFinite(v))));
}

export function isSlideshowRenderSpec(payload: unknown): payload is SlideshowRenderSpec {
  if (!payload || typeof payload !== 'object') return false;
  const candidate = payload as Record<string, unknown>;
  return (
    candidate.mode === 'slideshow' &&
    Array.isArray(candidate.images) &&
    Array.isArray(candidate.audios) &&
    candidate.images.every((v) => Number.isFinite(v)) &&
    candidate.audios.every((v) => Number.isFinite(v)) &&
    typeof candidate.intervalSeconds === 'number' &&
    typeof candidate.autoTime === 'boolean' &&
    typeof candidate.repeatImages === 'boolean' &&
    (candidate.outputFileName === undefined || typeof candidate.outputFileName === 'string')
  );
}

export function isWaveformRenderSpec(payload: unknown): payload is WaveformRenderSpec {
  if (!payload || typeof payload !== 'object') return false;
  const candidate = payload as Record<string, unknown>;
  return (
    candidate.mode === 'waveform' &&
    Array.isArray(candidate.audios) &&
    candidate.audios.every((v) => Number.isFinite(v)) &&
    typeof candidate.backgroundColor === 'string' &&
    typeof candidate.waveColor === 'string' &&
    (candidate.waveStyle === 'line' || candidate.waveStyle === 'bars' || candidate.waveStyle === 'circle') &&
    (candidate.outputFileName === undefined || typeof candidate.outputFileName === 'string')
  );
}

export function safeParseRenderSpec(raw: unknown): { spec: RenderSpec | null; error?: string } {
  if (raw === null || raw === undefined || raw === '') {
    return { spec: null };
  }

  let parsed: unknown = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch (err) {
      return { spec: null, error: 'renderSpec is not valid JSON' };
    }
  }

  if (isSlideshowRenderSpec(parsed) || isWaveformRenderSpec(parsed)) {
    return { spec: parsed };
  }

  return { spec: null, error: 'renderSpec does not match a supported shape' };
}

export function parseRenderSpec(raw: unknown): RenderSpec | null {
  return safeParseRenderSpec(raw).spec;
}
