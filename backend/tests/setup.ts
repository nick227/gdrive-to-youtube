import { vi } from 'vitest';

// Mock Prisma client for testing
vi.mock('../src/prismaClient', () => ({
  default: {
    user: {
      findUnique: vi.fn().mockResolvedValue({
        id: 1,
        googleSub: 'test-google-sub',
        email: 'test@example.com',
        name: 'Test User',
      }),
      upsert: vi.fn(),
    },
    mediaItem: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
    },
    uploadJob: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      update: vi.fn(),
    },
    renderJob: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    youtubeChannel: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
    },
    youtubeVideo: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
    },
    $transaction: vi.fn(async (fn: (client: unknown) => unknown) => fn({})),
    $disconnect: vi.fn(),
  },
}));

// Mock passport to simulate authenticated user
vi.mock('passport', () => ({
  default: {
    initialize: () => (_req: unknown, _res: unknown, next: () => void) => next(),
    session: () => (_req: unknown, _res: unknown, next: () => void) => next(),
    use: vi.fn(),
    serializeUser: vi.fn(),
    deserializeUser: vi.fn(),
    authenticate: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  },
}));
