import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import prisma from '../src/prismaClient';
import { mockUser } from './helpers';

// Mock requireAuth to allow test requests through
vi.mock('../src/auth/middleware', () => ({
  requireAuth: (req: { isAuthenticated: () => boolean; user: typeof mockUser }, _res: unknown, next: () => void) => {
    req.isAuthenticated = () => true;
    req.user = mockUser;
    next();
  },
  getCurrentUser: (req: { user?: typeof mockUser }) => req.user,
}));

describe('Render Jobs routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /render-jobs', () => {
    it('should return 400 if audioMediaItemId is missing', async () => {
      const response = await request(app)
        .post('/render-jobs')
        .send({});
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('audioMediaItemId is required');
    });

    it('should return 404 if audio media not found', async () => {
      vi.mocked(prisma.mediaItem.findUnique).mockResolvedValue(null);

      const response = await request(app)
        .post('/render-jobs')
        .send({ audioMediaItemId: 999 });
      
      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Audio media item not found');
    });

    it('should return 400 if media is not audio type', async () => {
      vi.mocked(prisma.mediaItem.findUnique).mockResolvedValue({
        id: 1,
        driveFileId: 'abc',
        name: 'video.mp4',
        mimeType: 'video/mp4',
        sizeBytes: BigInt(1024),
        folderId: null,
        folderPath: null,
        webViewLink: null,
        webContentLink: null,
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const response = await request(app)
        .post('/render-jobs')
        .send({ audioMediaItemId: 1 });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('audioMediaItemId must reference an audio file');
    });

    it('should create render job for valid audio', async () => {
      const audioMedia = {
        id: 1,
        driveFileId: 'audio123',
        name: 'song.mp3',
        mimeType: 'audio/mpeg',
        sizeBytes: BigInt(5000),
        folderId: null,
        folderPath: null,
        webViewLink: null,
        webContentLink: null,
        status: 'ACTIVE' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.mediaItem.findUnique).mockResolvedValue(audioMedia);
      vi.mocked(prisma.renderJob.create).mockResolvedValue({
        id: 1,
        audioMediaItemId: 1,
        imageMediaItemId: null,
        outputMediaItemId: null,
        waveformConfig: null,
        status: 'PENDING',
        errorMessage: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        audioMediaItem: audioMedia,
        imageMediaItem: null,
      } as never);

      const response = await request(app)
        .post('/render-jobs')
        .send({ audioMediaItemId: 1 });
      
      expect(response.status).toBe(201);
      expect(prisma.renderJob.create).toHaveBeenCalled();
    });
  });

  describe('GET /render-jobs', () => {
    it('should return empty array when no jobs', async () => {
      vi.mocked(prisma.renderJob.findMany).mockResolvedValue([]);

      const response = await request(app).get('/render-jobs');
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });
  });
});
