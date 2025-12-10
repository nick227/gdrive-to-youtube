import { Request, Response, NextFunction } from 'express';

interface UserPayload {
  id: number;
  googleSub: string;
  email: string;
  name: string | null;
}

// Require authentication
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ error: 'Authentication required' });
}

// Get current user from request
export function getCurrentUser(req: Request): UserPayload | undefined {
  return req.user as UserPayload | undefined;
}

