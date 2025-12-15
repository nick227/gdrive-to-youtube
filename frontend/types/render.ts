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
