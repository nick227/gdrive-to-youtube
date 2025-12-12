// src/utils/youtubeAuth.ts
import { google } from 'googleapis';
import prisma from '../prismaClient';
import fs from 'fs';
import path from 'node:path';
import { OAuth2Client } from 'google-auth-library';

type GoogleOAuthJson = {
  web?: {
    client_id: string;
    client_secret: string;
    redirect_uris?: string[];
  };
  installed?: {
    client_id: string;
    client_secret: string;
    redirect_uris?: string[];
  };
};

/**
 * Default fallback redirect.
 */
const PUBLIC_URL = process.env.PUBLIC_URL || 'http://localhost:4000';
const DEFAULT_REDIRECT_URI =
  process.env.YOUTUBE_REDIRECT_URI ||
  `${PUBLIC_URL}/channels/callback`;

/**
 * Read YouTube OAuth credentials.
 * Supports:
 *  1. Railway variable: YOUTUBE_APPLICATION_CREDENTIALS (JSON)
 *  2. File path to a credentials.json
 *  3. Raw env vars: YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET
 */
export function getOAuthCredentials() {
  const raw = process.env.YOUTUBE_APPLICATION_CREDENTIALS;

  if (raw) {
    try {
      let json: GoogleOAuthJson | undefined;

      // Case A — Raw JSON string in Railway
      if (raw.trim().startsWith('{')) {
        json = JSON.parse(raw);
      }
      // Case B — Treat as file path
      else if (fs.existsSync(path.resolve(raw))) {
        const fileContents = fs.readFileSync(path.resolve(raw), 'utf8');
        json = JSON.parse(fileContents);
      }

      if (json?.web) {
        const envRedirect = process.env.YOUTUBE_REDIRECT_URI;
        return {
          clientId: json.web.client_id,
          clientSecret: json.web.client_secret,
          // Env override wins; otherwise fall back to first redirect in credentials
          redirectUri: envRedirect || json.web.redirect_uris?.[0] || DEFAULT_REDIRECT_URI,
        };
      }

      if (json?.installed) {
        const envRedirect = process.env.YOUTUBE_REDIRECT_URI;
        return {
          clientId: json.installed.client_id,
          clientSecret: json.installed.client_secret,
          redirectUri:
            envRedirect || json.installed.redirect_uris?.[0] || DEFAULT_REDIRECT_URI,
        };
      }
    } catch (err) {
      console.error('Failed to parse YOUTUBE_APPLICATION_CREDENTIALS:', err);
    }
  }

  // Fallback to raw ENV vars
  return {
    clientId: process.env.YOUTUBE_CLIENT_ID || undefined,
    clientSecret: process.env.YOUTUBE_CLIENT_SECRET || undefined,
    redirectUri: DEFAULT_REDIRECT_URI,
  };
}

/**
 * Construct OAuth2 client.
 */
function getOAuth2Client() {
  const { clientId, clientSecret, redirectUri } = getOAuthCredentials();

  if (!clientId || !clientSecret) {
    throw new Error(
      'YouTube OAuth credentials not configured. Set YOUTUBE_APPLICATION_CREDENTIALS or YOUTUBE_CLIENT_ID/YOUTUBE_CLIENT_SECRET.'
    );
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

/**
 * Generate Google OAuth URL for linking YouTube channels.
 */
export function getAuthUrl(state?: string): string {
  const client = getOAuth2Client();

  const scopes = ['https://www.googleapis.com/auth/youtube.upload'];

  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: true,
    scope: scopes,
    state, // should be a nonce you validate server-side
  });
}

/**
 * Exchange OAuth "code" for tokens.
 */
export async function getTokensFromCode(code: string) {
  const client = getOAuth2Client();
  const { tokens } = await client.getToken(code);
  return tokens;
}

/**
 * Refresh tokens using stored refresh token.
 */
async function refreshAccessToken(refreshToken: string) {
  const client = getOAuth2Client();
  client.setCredentials({ refresh_token: refreshToken });
  const { credentials } = await client.refreshAccessToken();
  return credentials;
}

/**
 * Get YouTube OAuth client pre-configured with channel access/refresh tokens.
 * Automatically refreshes and persists new tokens.
 */
export async function getUserChannelAuth(userId: number, channelId: string): Promise<OAuth2Client> {
  const link = await prisma.youtubeChannelLink.findUnique({
    where: { userId_channelId: { userId, channelId } },
  });

  if (!link || (!link.accessToken && !link.refreshToken)) {
    throw new Error(`No OAuth credentials for user ${userId} on channel ${channelId}`);
  }

  let accessToken = link.accessToken || undefined;
  let refreshToken = link.refreshToken || undefined;
  const needsRefresh =
    !!refreshToken &&
    (!link.tokenExpiresAt || link.tokenExpiresAt.getTime() <= Date.now() + 60_000);

  if (needsRefresh) {
    try {
      const creds = await refreshAccessToken(refreshToken!);
      accessToken = creds.access_token || accessToken;
      if (creds.refresh_token) {
        refreshToken = creds.refresh_token;
      }
      const expires = creds.expiry_date ? new Date(creds.expiry_date) : null;

      await prisma.youtubeChannelLink.update({
        where: { userId_channelId: { userId, channelId } },
        data: {
          accessToken,
          refreshToken,
          tokenExpiresAt: expires,
        },
      });
    } catch (err) {
      console.error(`Failed to refresh YouTube tokens for user ${userId} channel ${channelId}:`, err);
    }
  }

  const client = getOAuth2Client();
  client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
    expiry_date: link.tokenExpiresAt?.getTime(),
  });

  return client;
}
