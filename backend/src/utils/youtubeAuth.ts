// src/utils/youtubeAuth.ts
import { google } from 'googleapis';
import prisma from '../prismaClient';
import fs from 'fs';
import path from 'node:path';

/**
 * Default fallback redirect.
 */
const DEFAULT_REDIRECT_URI =
  process.env.YOUTUBE_REDIRECT_URI ||
  'http://localhost:4000/channels/callback';

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
      let json: any;

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
        return {
          clientId: json.web.client_id,
          clientSecret: json.web.client_secret,
          redirectUri: json.web.redirect_uris?.[0] || DEFAULT_REDIRECT_URI,
        };
      }

      if (json?.installed) {
        return {
          clientId: json.installed.client_id,
          clientSecret: json.installed.client_secret,
          redirectUri:
            json.installed.redirect_uris?.[0] || DEFAULT_REDIRECT_URI,
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

  const scopes = [
    'https://www.googleapis.com/auth/youtube.upload',
    'https://www.googleapis.com/auth/youtube.readonly',
  ];

  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: scopes,
    state,
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
export async function getOrRefreshChannelAuth(channelId: string) {
  const channel = await prisma.youtubeChannel.findUnique({
    where: { channelId },
  });

  if (!channel || !channel.accessToken) {
    throw new Error(`Channel ${channelId} not found or not authenticated.`);
  }

  let { accessToken, refreshToken } = channel;

  // Refresh if refresh token exists
  if (refreshToken) {
    try {
      const creds = await refreshAccessToken(refreshToken);

      accessToken = creds.access_token || accessToken;

      // Google sometimes returns a NEW refresh token
      if (creds.refresh_token) {
        refreshToken = creds.refresh_token;
      }

      await prisma.youtubeChannel.update({
        where: { channelId },
        data: {
          accessToken,
          refreshToken,
        },
      });
    } catch (err) {
      console.error(`Failed to refresh YouTube tokens for ${channelId}:`, err);
    }
  }

  // Create authenticated client
  const client = getOAuth2Client();
  client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  return client;
}
