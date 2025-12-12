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

describe('Upload Jobs routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /upload-jobs', () => {
    it('should return 400 if required fields are missing', async () => {
      const response = await request(app)
        .post('/upload-jobs')
        .send({});
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Missing required fields');
    });

    it('should return 400 for invalid privacyStatus', async () => {
      const response = await request(app)
        .post('/upload-jobs')
        .send({
          mediaItemId: 1,
          youtubeChannelId: 1,
          title: 'Test',
          description: 'Test desc',
          privacyStatus: 'INVALID',
        });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid privacyStatus');
    });

    it('should create upload job with valid data', async () => {
      const mockJob = {
        id: 1,
        mediaItemId: 1,
        youtubeChannelId: 1,
        requestedByUserId: 1,
        youtubeVideoId: null,
        thumbnailMediaItemId: null,
        title: 'Test Video',
        description: 'Test description',
        tags: null,
        privacyStatus: 'PUBLIC' as const,
        scheduledFor: null,
        status: 'PENDING' as const,
        errorMessage: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.uploadJob.create).mockResolvedValue(mockJob);

      const response = await request(app)
        .post('/upload-jobs')
        .send({
          mediaItemId: 1,
          youtubeChannelId: 1,
          title: 'Test Video',
          description: 'Test description',
          privacyStatus: 'PUBLIC',
        });
      
      expect(response.status).toBe(201);
      expect(prisma.uploadJob.create).toHaveBeenCalled();
    });
  });

  describe('GET /upload-jobs', () => {
    it('should return empty array when no jobs', async () => {
      vi.mocked(prisma.uploadJob.findMany).mockResolvedValue([]);

      const response = await request(app).get('/upload-jobs');
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });
  });
});
