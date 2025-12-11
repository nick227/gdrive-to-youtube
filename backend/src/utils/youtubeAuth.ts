import { google } from 'googleapis';
import prisma from '../prismaClient';
import fs from 'fs';
import path from 'node:path';

const DEFAULT_REDIRECT_URI =
  process.env.YOUTUBE_REDIRECT_URI || 'http://localhost:4000/channels/callback';

export function getOAuthCredentials() {
  const raw = process.env.YOUTUBE_APPLICATION_CREDENTIALS;

  if (raw) {
    try {
      // ---- CASE 1: Railway JSON ----
      if (raw.trim().startsWith('{')) {
        const json = JSON.parse(raw);

        if (json.web) {
          return {
            clientId: json.web.client_id,
            clientSecret: json.web.client_secret,
            redirectUri: json.web.redirect_uris?.[0] || DEFAULT_REDIRECT_URI,
          };
        }
      }

      // ---- CASE 2: Local file path ----
      if (fs.existsSync(raw)) {
        const fileJson = JSON.parse(fs.readFileSync(path.resolve(raw), 'utf8'));

        if (fileJson.web) {
          return {
            clientId: fileJson.web.client_id,
            clientSecret: fileJson.web.client_secret,
            redirectUri: fileJson.web.redirect_uris?.[0] || DEFAULT_REDIRECT_URI,
          };
        }
      }
    } catch (err) {
      console.error('Error loading YouTube OAuth credentials:', err);
    }
  }

  // ---- CASE 3: Individual env vars ----
  return {
    clientId: process.env.YOUTUBE_CLIENT_ID,
    clientSecret: process.env.YOUTUBE_CLIENT_SECRET,
    redirectUri: DEFAULT_REDIRECT_URI,
  };
}
