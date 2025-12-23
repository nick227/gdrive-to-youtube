import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import prisma from '../src/prismaClient';
import { processRenderJob } from '../src/workers/processRenderJobs';
import { downloadMediaBatch } from '../src/rendering/download';
import {
  buildSlideshowFrames,
  concatAudios,
  createSlideshowVideo,
  getAudioDurationSeconds,
  muxAudioAndVideo,
} from '../src/rendering/slideshow';
import { renderWaveformVideo } from '../src/rendering/waveform';
import { uploadMp4ToDrive } from '../src/rendering/upload';
import { getDriveClientById } from '../src/utils/driveConnectionClient';
import type { RenderJobWithRelations } from '../src/rendering/mediaResolver';

vi.mock('../src/rendering/download', () => ({
  downloadMediaBatch: vi.fn(),
}));

vi.mock('../src/rendering/slideshow', () => ({
  buildSlideshowFrames: vi.fn(),
  concatAudios: vi.fn(),
  createSlideshowVideo: vi.fn(),
  getAudioDurationSeconds: vi.fn(),
  muxAudioAndVideo: vi.fn(),
}));

vi.mock('../src/rendering/waveform', () => ({
  renderWaveformVideo: vi.fn(),
}));

vi.mock('../src/rendering/upload', () => ({
  uploadMp4ToDrive: vi.fn(),
}));

vi.mock('../src/utils/driveConnectionClient', () => ({
  getDriveClientById: vi.fn(),
}));

describe('processRenderJob e2e', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('processes a slideshow render and cleans up temp files', async () => {
    const createdPaths: string[] = [];
    let tempDir: string | null = null;

    const audioItem1 = {
      id: 1,
      driveFileId: 'audio-1',
      name: 'track-one.mp3',
      mimeType: 'audio/mpeg',
      sizeBytes: BigInt(1000),
      folderId: null,
      folderPath: null,
      webViewLink: null,
      webContentLink: null,
      driveConnectionId: 'drive-1',
      status: 'ACTIVE' as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const audioItem2 = {
      ...audioItem1,
      id: 2,
      driveFileId: 'audio-2',
      name: 'track-two.mp3',
    };
    const imageItem = {
      id: 10,
      driveFileId: 'image-10',
      name: 'cover.png',
      mimeType: 'image/png',
      sizeBytes: BigInt(2000),
      folderId: null,
      folderPath: null,
      webViewLink: null,
      webContentLink: null,
      driveConnectionId: 'drive-1',
      status: 'ACTIVE' as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const renderSpec = JSON.stringify({
      mode: 'slideshow',
      audios: [audioItem1.id, audioItem2.id],
      images: [imageItem.id],
      intervalSeconds: 5,
      autoTime: false,
      repeatImages: false,
      outputFileName: 'unit-test',
    });

    const job = {
      id: 99,
      renderSpec,
      audioMediaItemId: audioItem1.id,
      audioMediaItem: audioItem1,
      imageMediaItemId: imageItem.id,
      imageMediaItem: imageItem,
      outputMediaItemId: null,
      outputMediaItem: null,
      requestedByUserId: 1,
      requestedByUser: null,
      driveConnectionId: 'drive-1',
      driveConnection: null,
      waveformConfig: null,
      status: 'PENDING',
      errorMessage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as RenderJobWithRelations;

    vi.mocked(getDriveClientById).mockResolvedValue({
      drive: {} as never,
      connection: { id: 'drive-1', rootFolderId: 'root' } as never,
    });

    vi.mocked(prisma.renderJob.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.mediaItem.findMany).mockResolvedValue([audioItem2] as never);

    const createdMediaItem = {
      id: 123,
      driveFileId: 'uploaded-id',
      name: 'unit-test.mp4',
    };
    const txRenderJobUpdate = vi.fn().mockResolvedValue(null);
    const txMediaItemCreate = vi.fn().mockResolvedValue(createdMediaItem);

    vi.mocked(prisma.$transaction).mockImplementation(async (fn) => {
      const tx = {
        renderJob: {
          findUnique: vi.fn().mockResolvedValue({ outputMediaItemId: null }),
          update: txRenderJobUpdate,
        },
        mediaItem: {
          findUnique: vi.fn().mockResolvedValue(null),
          create: txMediaItemCreate,
        },
      };
      return fn(tx as never);
    });

    vi.mocked(downloadMediaBatch).mockImplementation(
      async (_drive, items, labelPrefix, tempFiles, baseDir) => {
        const dir = baseDir ?? fs.mkdtempSync(path.join(os.tmpdir(), 'render-job-test-'));
        tempDir = dir;
        return items.map((item) => {
          const filePath = path.join(dir, `${labelPrefix}-${item.id}.bin`);
          fs.writeFileSync(filePath, `${labelPrefix}:${item.id}`);
          tempFiles.push(filePath);
          createdPaths.push(filePath);
          return filePath;
        });
      }
    );

    vi.mocked(concatAudios).mockImplementation(async (_audioPaths, tmpDir, tempFiles) => {
      const outputPath = path.join(tmpDir, 'audio-merged-test.mp3');
      fs.writeFileSync(outputPath, 'merged');
      tempFiles.push(outputPath);
      createdPaths.push(outputPath);
      return outputPath;
    });

    vi.mocked(getAudioDurationSeconds).mockResolvedValue(12);

    vi.mocked(buildSlideshowFrames).mockImplementation(
      (paths, _totalAudioSeconds, perImageSeconds, _repeatImages) =>
        paths.map((p) => ({ path: p, duration: perImageSeconds }))
    );

    vi.mocked(createSlideshowVideo).mockImplementation(async (_frames, tmpDir, tempFiles) => {
      const outputPath = path.join(tmpDir, 'slideshow-test.mp4');
      fs.writeFileSync(outputPath, 'video');
      tempFiles.push(outputPath);
      createdPaths.push(outputPath);
      return outputPath;
    });

    vi.mocked(muxAudioAndVideo).mockImplementation(async (_videoPath, _audioPath, outputPath) => {
      fs.writeFileSync(outputPath, 'rendered');
      createdPaths.push(outputPath);
    });

    vi.mocked(uploadMp4ToDrive).mockResolvedValue({
      id: 'drive-file-id',
      name: 'unit-test.mp4',
      driveConnectionId: 'drive-1',
    });

    vi.mocked(renderWaveformVideo).mockResolvedValue();

    await processRenderJob(job);

    expect(prisma.renderJob.updateMany).toHaveBeenCalled();
    expect(uploadMp4ToDrive).toHaveBeenCalled();
    expect(txMediaItemCreate).toHaveBeenCalled();
    expect(txRenderJobUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'SUCCESS' }) })
    );

    if (tempDir) {
      for (const filePath of createdPaths) {
        expect(fs.existsSync(filePath)).toBe(false);
      }
      expect(fs.existsSync(tempDir)).toBe(false);
    }
  });

  it('processes a waveform render without downloading images', async () => {
    const createdPaths: string[] = [];
    let tempDir: string | null = null;

    const audioItem = {
      id: 5,
      driveFileId: 'audio-5',
      name: 'wave-track.mp3',
      mimeType: 'audio/mpeg',
      sizeBytes: BigInt(1000),
      folderId: null,
      folderPath: null,
      webViewLink: null,
      webContentLink: null,
      driveConnectionId: 'drive-1',
      status: 'ACTIVE' as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const renderSpec = JSON.stringify({
      mode: 'waveform',
      audios: [audioItem.id],
      backgroundColor: '#000000',
      waveColor: '#ff00cc',
      waveStyle: 'bars',
      outputFileName: 'wave-test',
    });

    const job = {
      id: 100,
      renderSpec,
      audioMediaItemId: audioItem.id,
      audioMediaItem: audioItem,
      imageMediaItemId: null,
      imageMediaItem: null,
      outputMediaItemId: null,
      outputMediaItem: null,
      requestedByUserId: 1,
      requestedByUser: null,
      driveConnectionId: 'drive-1',
      driveConnection: null,
      waveformConfig: null,
      status: 'PENDING',
      errorMessage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as RenderJobWithRelations;

    vi.mocked(getDriveClientById).mockResolvedValue({
      drive: {} as never,
      connection: { id: 'drive-1', rootFolderId: 'root' } as never,
    });

    vi.mocked(prisma.renderJob.updateMany).mockResolvedValue({ count: 1 });

    const createdMediaItem = {
      id: 321,
      driveFileId: 'uploaded-id',
      name: 'wave-test.mp4',
    };
    const txRenderJobUpdate = vi.fn().mockResolvedValue(null);
    const txMediaItemCreate = vi.fn().mockResolvedValue(createdMediaItem);

    vi.mocked(prisma.$transaction).mockImplementation(async (fn) => {
      const tx = {
        renderJob: {
          findUnique: vi.fn().mockResolvedValue({ outputMediaItemId: null }),
          update: txRenderJobUpdate,
        },
        mediaItem: {
          findUnique: vi.fn().mockResolvedValue(null),
          create: txMediaItemCreate,
        },
      };
      return fn(tx as never);
    });

    vi.mocked(downloadMediaBatch).mockImplementation(
      async (_drive, items, labelPrefix, tempFiles, baseDir) => {
        const dir = baseDir ?? fs.mkdtempSync(path.join(os.tmpdir(), 'render-job-test-'));
        tempDir = dir;
        return items.map((item) => {
          const filePath = path.join(dir, `${labelPrefix}-${item.id}.bin`);
          fs.writeFileSync(filePath, `${labelPrefix}:${item.id}`);
          tempFiles.push(filePath);
          createdPaths.push(filePath);
          return filePath;
        });
      }
    );

    vi.mocked(concatAudios).mockImplementation(async (_audioPaths, tmpDir, tempFiles) => {
      const outputPath = path.join(tmpDir, 'audio-merged-wave.mp3');
      fs.writeFileSync(outputPath, 'merged');
      tempFiles.push(outputPath);
      createdPaths.push(outputPath);
      return outputPath;
    });

    vi.mocked(getAudioDurationSeconds).mockResolvedValue(30);

    vi.mocked(renderWaveformVideo).mockImplementation(async (_audioPath, outputPath) => {
      fs.writeFileSync(outputPath, 'wave-video');
      createdPaths.push(outputPath);
    });

    vi.mocked(uploadMp4ToDrive).mockResolvedValue({
      id: 'drive-file-id',
      name: 'wave-test.mp4',
      driveConnectionId: 'drive-1',
    });

    await processRenderJob(job);

    expect(downloadMediaBatch).toHaveBeenCalledTimes(1);
    expect(renderWaveformVideo).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({ waveStyle: 'bars' })
    );
    expect(createSlideshowVideo).not.toHaveBeenCalled();
    expect(muxAudioAndVideo).not.toHaveBeenCalled();
    expect(txMediaItemCreate).toHaveBeenCalled();
    expect(txRenderJobUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'SUCCESS' }) })
    );

    if (tempDir) {
      for (const filePath of createdPaths) {
        expect(fs.existsSync(filePath)).toBe(false);
      }
      expect(fs.existsSync(tempDir)).toBe(false);
    }
  });
});
