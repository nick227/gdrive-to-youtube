import { Request, Response, NextFunction } from 'express';

// Mock user for authenticated tests
export const mockUser = {
  id: 1,
  googleSub: 'test-google-sub',
  email: 'test@example.com',
  name: 'Test User',
};

// Helper to create an authenticated request
export function withAuth(agent: { set: (key: string, value: string) => unknown }) {
  return agent;
}

// Mock the requireAuth middleware to inject a test user
export function mockAuthMiddleware(req: Request, _res: Response, next: NextFunction) {
  req.isAuthenticated = function (): this is Request & { user: typeof mockUser } {
    return true;
  };
  req.user = mockUser;
  next();
}
