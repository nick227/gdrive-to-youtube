import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

export type SlideFrame = { path: string; duration: number };

function escapePathForConcat(filePath: string): string {
  const forward = filePath.replace(/\\/g, '/');
  return forward.replace(/'/g, "'\\''");
}

export async function getAudioDurationSeconds(audioPath: string): Promise<number | null> {
  return new Promise((resolve) => {
    const args = [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'default=noprint_wrappers=1:nokey=1',
      audioPath,
    ];

    const ff = spawn('ffprobe', args);

    let output = '';
    ff.stdout.on('data', (data) => {
      output += data.toString();
    });

    ff.on('close', () => {
      const duration = parseFloat(output.trim());
      if (Number.isFinite(duration)) {
        resolve(duration);
      } else {
        resolve(null);
      }
    });

    ff.on('error', () => resolve(null));
  });
}

export async function concatAudios(
  audioPaths: string[],
  tmpDir: string,
  tempFiles: string[]
): Promise<string> {
  if (audioPaths.length === 1) return audioPaths[0];

  const listPath = path.join(tmpDir, `audio-concat-${Date.now()}.txt`);
  const lines = audioPaths.map((p) => `file '${escapePathForConcat(p)}'`).join('\n');
  fs.writeFileSync(listPath, lines, 'utf-8');
  tempFiles.push(listPath);

  const outputPath = path.join(tmpDir, `audio-merged-${Date.now()}.mp3`);
  tempFiles.push(outputPath);

  await new Promise<void>((resolve, reject) => {
    const args = ['-y', '-f', 'concat', '-safe', '0', '-i', listPath, '-c', 'copy', outputPath];
    const ff = spawn('ffmpeg', args);
    ff.stderr.on('data', (d) => console.log(`[ffmpeg concat audio] ${d}`));
    ff.on('error', reject);
    ff.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg concat audio exited with code ${code}`));
    });
  });

  return outputPath;
}

export function buildSlideshowFrames(
  imagePaths: string[],
  totalAudioSeconds: number | null,
  perImageSeconds: number,
  repeatImages: boolean
): SlideFrame[] {
  if (imagePaths.length === 0) {
    throw new Error('Slideshow requires at least one image');
  }

  const minDuration = 0.1;
  const safePerImage = perImageSeconds > minDuration ? perImageSeconds : minDuration;
  const targetDuration =
    totalAudioSeconds && totalAudioSeconds > 0
      ? totalAudioSeconds
      : safePerImage * imagePaths.length;

  const frames: SlideFrame[] = [];

  if (repeatImages) {
    let elapsed = 0;
    let idx = 0;
    while (elapsed + minDuration < targetDuration || frames.length === 0) {
      const remaining = targetDuration - elapsed;
      const duration = Math.max(minDuration, Math.min(safePerImage, remaining));
      frames.push({ path: imagePaths[idx % imagePaths.length], duration });
      elapsed += duration;
      idx += 1;
    }
    if (totalAudioSeconds && elapsed < totalAudioSeconds) {
      const delta = totalAudioSeconds - elapsed;
      frames[frames.length - 1].duration += delta;
    }
    return frames;
  }

  const baseDurations = imagePaths.map(() => safePerImage);
  if (totalAudioSeconds && totalAudioSeconds > 0) {
    const usedBeforeLast = safePerImage * Math.max(imagePaths.length - 1, 0);
    const lastDuration = Math.max(minDuration, totalAudioSeconds - usedBeforeLast);
    baseDurations[baseDurations.length - 1] = lastDuration;
  }

  return imagePaths.map((p, i) => ({ path: p, duration: baseDurations[i] }));
}

export async function createSlideshowVideo(
  frames: SlideFrame[],
  tmpDir: string,
  tempFiles: string[]
): Promise<string> {
  if (frames.length === 0) {
    throw new Error('No frames provided for slideshow video');
  }

  const listPath = path.join(tmpDir, `slideshow-${Date.now()}.txt`);
  const lines = frames
    .map((frame) => `file '${escapePathForConcat(frame.path)}'\nduration ${frame.duration}`)
    .join('\n');
  const lastFileLine = `\nfile '${escapePathForConcat(frames[frames.length - 1].path)}'`;
  fs.writeFileSync(listPath, lines + lastFileLine, 'utf-8');
  tempFiles.push(listPath);

  const outputPath = path.join(tmpDir, `slideshow-${Date.now()}.mp4`);
  tempFiles.push(outputPath);

  await new Promise<void>((resolve, reject) => {
    const args = [
      '-y',
      '-f',
      'concat',
      '-safe',
      '0',
      '-i',
      listPath,
      '-fps_mode',
      'vfr',
      '-pix_fmt',
      'yuv420p',
      '-movflags',
      '+faststart',
      outputPath,
    ];
    const ff = spawn('ffmpeg', args);
    ff.stderr.on('data', (d) => console.log(`[ffmpeg slideshow] ${d}`));
    ff.on('error', reject);
    ff.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg slideshow exited with code ${code}`));
    });
  });

  return outputPath;
}

export async function muxAudioAndVideo(
  videoPath: string,
  audioPath: string,
  outputPath: string
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const args = [
      '-y',
      '-i',
      videoPath,
      '-i',
      audioPath,
      '-c:v',
      'copy',
      '-c:a',
      'aac',
      '-b:a',
      '192k',
      '-shortest',
      outputPath,
    ];
    const ff = spawn('ffmpeg', args);
    ff.stderr.on('data', (d) => console.log(`[ffmpeg mux] ${d}`));
    ff.on('error', reject);
    ff.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg mux exited with code ${code}`));
    });
  });
}
