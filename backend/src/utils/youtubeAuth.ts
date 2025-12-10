// src/utils/youtubeAuth.ts
import { google } from 'googleapis';
import prisma from '../prismaClient';
import fs from 'fs';
import path from 'node:path';

const DEFAULT_REDIRECT_URI =
  process.env.YOUTUBE_REDIRECT_URI || 'http://localhost:4000/channels/callback';

export function getOAuthCredentials() {
  const credentialsPath = process.env.YOUTUBE_APPLICATION_CREDENTIALS;

  if (credentialsPath) {
    try {
      const credentialsFile = fs.readFileSync(
        path.resolve(credentialsPath),
        'utf8'
      );
      const credentials = JSON.parse(credentialsFile);

      if (credentials.web) {
        return {
          clientId: credentials.web.client_id,
          clientSecret: credentials.web.client_secret,
          redirectUri: credentials.web.redirect_uris?.[0] || DEFAULT_REDIRECT_URI,
        };
      }
    } catch (error) {
      console.error(
        'Failed to load YouTube OAuth credentials from file:',
        error
      );
    }
  }

  return {
    clientId: process.env.YOUTUBE_CLIENT_ID,
    clientSecret: process.env.YOUTUBE_CLIENT_SECRET,
    redirectUri: DEFAULT_REDIRECT_URI,
  };
}

function getOAuth2Client() {
  const { clientId, clientSecret, redirectUri } = getOAuthCredentials();

  if (!clientId || !clientSecret) {
    throw new Error(
      'YouTube OAuth credentials not configured. Set YOUTUBE_APPLICATION_CREDENTIALS or YOUTUBE_CLIENT_ID/YOUTUBE_CLIENT_SECRET'
    );
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export function getAuthUrl(state?: string): string {
  const oauth2Client = getOAuth2Client();
  const scopes = [
    'https://www.googleapis.com/auth/youtube.upload',
    'https://www.googleapis.com/auth/youtube.readonly',
  ];

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent',
    state: state || undefined,
  });
}

export async function getTokensFromCode(code: string) {
  const oauth2Client = getOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

async function refreshAccessToken(refreshToken: string) {
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  const { credentials } = await oauth2Client.refreshAccessToken();
  return credentials;
}

function getAuthenticatedClient(accessToken: string, refreshToken?: string) {
  const { clientId, clientSecret, redirectUri } = getOAuthCredentials();

  if (!clientId || !clientSecret) {
    throw new Error(
      'YouTube OAuth credentials not configured. Set YOUTUBE_APPLICATION_CREDENTIALS or YOUTUBE_CLIENT_ID/YOUTUBE_CLIENT_SECRET'
    );
  }

  const client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

  client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  return client;
}

export async function getOrRefreshChannelAuth(channelId: string) {
  const channel = await prisma.youtubeChannel.findUnique({
    where: { channelId },
  });

  if (!channel || !channel.accessToken) {
    throw new Error(`Channel ${channelId} not found or not authenticated`);
  }

  let accessToken = channel.accessToken;
  let refreshToken = channel.refreshToken;

  if (refreshToken) {
    try {
      const credentials = await refreshAccessToken(refreshToken);
      accessToken = credentials.access_token || accessToken;

      if (credentials.refresh_token) {
        refreshToken = credentials.refresh_token;
      }

      await prisma.youtubeChannel.update({
        where: { channelId },
        data: {
          accessToken,
          refreshToken,
        },
      });
    } catch (error) {
      console.error(
        `Failed to refresh token for channel ${channelId}:`,
        error
      );
    }
  }

  return getAuthenticatedClient(accessToken, refreshToken || undefined);
}
