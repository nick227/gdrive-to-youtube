import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import prisma from '../prismaClient';
import { getOAuthCredentials } from '../utils/youtubeAuth';

const { clientId, clientSecret } = getOAuthCredentials();
const publicUrl = process.env.PUBLIC_URL || 'http://localhost:4000';
const callbackURL = process.env.AUTH_CALLBACK_URL || `${publicUrl}/auth/google/callback`;

if (!clientId || !clientSecret) {
  console.warn('WARNING: Google OAuth credentials not configured. Set YOUTUBE_APPLICATION_CREDENTIALS. Google login will not work.');
}

if (clientId && clientSecret) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: clientId,
        clientSecret: clientSecret,
        callbackURL,
        scope: ['profile', 'email'],
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const googleSub = profile.id;
          const email = profile.emails?.[0]?.value;
          const name = profile.displayName;
          const avatarUrl = profile.photos?.[0]?.value || null;

          if (!email) {
            return done(new Error('No email found in Google profile'));
          }

          // Upsert user
          const user = await prisma.user.upsert({
            where: { googleSub },
            create: {
              googleSub,
              email,
              name,
              avatarUrl,
            },
            update: {
              email,
              name,
              avatarUrl,
            },
          });

          return done(null, user);
        } catch (error) {
          return done(error as Error);
        }
      }
    )
  );
}

// Serialize user to session
passport.serializeUser((user, done) => {
  done(null, (user as { id: number }).id);
});

// Deserialize user from session
passport.deserializeUser(async (id: number, done) => {
  try {
    const user = await prisma.user.findUnique({ where: { id } });
    done(null, user);
  } catch (error) {
    done(error);
  }
});

export default passport;
