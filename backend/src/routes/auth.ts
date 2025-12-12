import { Router } from 'express';
import passport from '../auth/passport';
import { getCurrentUser } from '../auth/middleware';

const router = Router();

// Get current user
router.get('/me', (req, res) => {
  const user = getCurrentUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
  });
});

// Start Google OAuth flow
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// Google OAuth callback
router.get(
  '/google/callback',
  passport.authenticate('google', { failureRedirect: '/auth/failure' }),
  (req, res) => {
    const frontendUrl =
      process.env.FRONTEND_URL ||
      process.env.PUBLIC_URL ||
      'http://localhost:3000';
    res.redirect(`${frontendUrl}?loggedIn=true`);
  }
);

// Auth failure
router.get('/failure', (_req, res) => {
  res.status(401).json({ error: 'Authentication failed' });
});

// Logout
router.post('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.json({ ok: true });
  });
});

export default router;

