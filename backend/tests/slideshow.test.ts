import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';
import { describe, expect, it } from 'vitest';
import { createSlideshowVideo, SlideFrame } from '../src/rendering/slideshow';

async function createColorImagePng(outputPath: string, color: string) {
  return new Promise<void>((resolve, reject) => {
    const args = [
      '-y',
      '-f',
      'lavfi',
      '-i',
      `color=c=${color}:s=64x64`,
      '-frames:v',
      '1',
      '-v',
      'error',
      outputPath,
    ];
    const ff = spawn('ffmpeg', args);
    let err = '';
    ff.stderr.on('data', (d) => {
      err += d.toString();
    });
    ff.on('error', reject);
    ff.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg image gen exited with code ${code}: ${err}`));
    });
  });
}

async function ffprobeDurationSeconds(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const args = [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'default=noprint_wrappers=1:nokey=1',
      filePath,
    ];
    const ff = spawn('ffprobe', args);
    let output = '';
    let err = '';
    ff.stdout.on('data', (d) => {
      output += d.toString();
    });
    ff.stderr.on('data', (d) => {
      err += d.toString();
    });
    ff.on('error', reject);
    ff.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`ffprobe exited with code ${code}: ${err}`));
        return;
      }
      const parsed = parseFloat(output.trim());
      if (Number.isFinite(parsed)) resolve(parsed);
      else reject(new Error(`ffprobe did not return a numeric duration: "${output}"`));
    });
  });
}

describe('createSlideshowVideo', () => {
  it('renders multiple still images into a multi-frame video', async () => {
    const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'slideshow-test-'));
    const tempFiles: string[] = [];

    const img1 = path.join(tmpDir, 'img1.png');
    const img2 = path.join(tmpDir, 'img2.png');
    await createColorImagePng(img1, 'red');
    await createColorImagePng(img2, 'blue');

    const frames: SlideFrame[] = [
      { path: img1, duration: 0.5 },
      { path: img2, duration: 0.5 },
    ];

    let videoPath = '';
    try {
      videoPath = await createSlideshowVideo(frames, tmpDir, tempFiles);
      tempFiles.push(videoPath);
      const duration = await ffprobeDurationSeconds(videoPath);

      expect(duration).toBeGreaterThan(0.9);
      expect(duration).toBeLessThan(2);
      expect(fs.existsSync(videoPath)).toBe(true);
    } finally {
      await Promise.all(
        tempFiles.map((p) => fs.promises.rm(p, { force: true, recursive: true }))
      );
      await fs.promises.rm(tmpDir, { force: true, recursive: true });
    }
  });
});
