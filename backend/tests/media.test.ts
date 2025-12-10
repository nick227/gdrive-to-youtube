import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import prisma from '../src/prismaClient';

describe('Media routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /media', () => {
    it('should return empty array when no media', async () => {
      vi.mocked(prisma.mediaItem.findMany).mockResolvedValue([]);

      const response = await request(app).get('/media');
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it('should return media items with serialized sizeBytes', async () => {
      vi.mocked(prisma.mediaItem.findMany).mockResolvedValue([
        {
          id: 1,
          driveFileId: 'abc123',
          name: 'test.mp4',
          mimeType: 'video/mp4',
          sizeBytes: BigInt(1024),
          folderId: null,
          folderPath: null,
          webViewLink: null,
          webContentLink: null,
          status: 'ACTIVE',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
      ]);

      const response = await request(app).get('/media');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].sizeBytes).toBe('1024');
      expect(response.body[0].name).toBe('test.mp4');
    });
  });
});

