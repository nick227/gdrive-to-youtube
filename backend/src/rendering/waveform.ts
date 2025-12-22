import { spawn } from 'child_process';

export type WaveformStyle = 'line' | 'bars' | 'circle';

export type WaveformRenderOptions = {
  backgroundColor: string;
  waveColor: string;
  waveStyle: WaveformStyle;
  width?: number;
  height?: number;
  fps?: number;
};

const DEFAULT_WIDTH = 1280;
const DEFAULT_HEIGHT = 720;
const DEFAULT_FPS = 30;

function parseHexColor(value: string | undefined): string | null {
  if (!value) return null;
  const cleaned = value.trim();
  const match = cleaned.match(/^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/);
  if (!match) return null;
  let hex = match[1];
  if (hex.length === 3) {
    hex = hex
      .split('')
      .map((c) => c + c)
      .join('');
  } else if (hex.length === 8) {
    hex = hex.slice(0, 6);
  }
  return hex.toLowerCase();
}

function normalizeColor(value: string | undefined, fallback: string): string {
  const parsed = parseHexColor(value) ?? parseHexColor(fallback) ?? '000000';
  return `0x${parsed}`;
}

function buildWaveformFilterGraph(options: WaveformRenderOptions): string {
  const width = options.width ?? DEFAULT_WIDTH;
  const height = options.height ?? DEFAULT_HEIGHT;
  const fps = options.fps ?? DEFAULT_FPS;
  const backgroundColor = normalizeColor(options.backgroundColor, '#000000');
  const waveColor = normalizeColor(options.waveColor, '#00ffcc');
  const baseSize = `${width}x${height}`;

  if (options.waveStyle === 'circle') {
    const circleSize = Math.min(width, height);
    const circleSizeValue = `${circleSize}x${circleSize}`;

    return [
      `color=c=${backgroundColor}:s=${baseSize}:r=${fps},format=rgba[bg]`,
      `color=c=${waveColor}:s=${circleSizeValue}:r=${fps},format=rgba[wave]`,
      `[0:a]aformat=channel_layouts=stereo,avectorscope=s=${circleSizeValue}:mode=polar:rate=${fps}:draw=aaline:scale=sqrt:rc=255:gc=255:bc=255:ac=255:rf=0:gf=0:bf=0:af=0,format=gray[mask]`,
      `[wave][mask]alphamerge[wavea]`,
      `[bg][wavea]overlay=x=(main_w-overlay_w)/2:y=(main_h-overlay_h)/2:shortest=1:format=auto[vid]`,
    ].join(';');
  }

  const mode = options.waveStyle === 'bars' ? 'cline' : 'line';
  const draw = options.waveStyle === 'bars' ? 'full' : 'scale';

  return [
    `color=c=${backgroundColor}:s=${baseSize}:r=${fps},format=rgba[bg]`,
    `color=c=${waveColor}:s=${baseSize}:r=${fps},format=rgba[wave]`,
    `[0:a]aformat=channel_layouts=stereo,showwaves=s=${baseSize}:mode=${mode}:rate=${fps}:colors=white:scale=sqrt:draw=${draw},format=gray[mask]`,
    `[wave][mask]alphamerge[wavea]`,
    `[bg][wavea]overlay=shortest=1:format=auto[vid]`,
  ].join(';');
}

export async function renderWaveformVideo(
  audioPath: string,
  outputPath: string,
  options: WaveformRenderOptions
): Promise<void> {
  const filterGraph = buildWaveformFilterGraph(options);

  await new Promise<void>((resolve, reject) => {
    const args = [
      '-y',
      '-i',
      audioPath,
      '-filter_complex',
      filterGraph,
      '-map',
      '[vid]',
      '-map',
      '0:a:0',
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      '20',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      '-b:a',
      '192k',
      '-shortest',
      '-movflags',
      '+faststart',
      outputPath,
    ];
    const ff = spawn('ffmpeg', args);
    ff.stderr.on('data', (d) => console.log(`[ffmpeg waveform] ${d}`));
    ff.on('error', reject);
    ff.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg waveform exited with code ${code}`));
    });
  });
}
