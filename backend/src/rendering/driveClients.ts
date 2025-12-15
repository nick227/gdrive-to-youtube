// driveClients.ts
import { google } from 'googleapis';
import type { Credentials } from 'google-auth-library';
import { getServiceAccountAuth } from '../utils/serviceAccountAuth';

export function getDriveReadClient() {
  const auth = getServiceAccountAuth([
    'https://www.googleapis.com/auth/drive.readonly',
  ]);

  return google.drive({ version: 'v3', auth });
}

export function getDriveServiceClient() {
  const auth = getServiceAccountAuth([
    'https://www.googleapis.com/auth/drive',
  ]);

  return google.drive({ version: 'v3', auth });
}

export function getDriveWriteClient() {
  const tokensJson = process.env.DRIVE_OAUTH_TOKENS;
  if (!tokensJson) {
    throw new Error('DRIVE_OAUTH_TOKENS is not set');
  }

  const clientId = process.env.DRIVE_CLIENT_ID;
  const clientSecret = process.env.DRIVE_CLIENT_SECRET;
  const redirectUri =
    process.env.DRIVE_REDIRECT_URI || 'http://localhost:4000/oauth2callback';

  if (!clientId || !clientSecret) {
    throw new Error(
      'DRIVE_CLIENT_ID / DRIVE_CLIENT_SECRET are not set (needed for OAuth uploads)'
    );
  }

  let tokens: Credentials;
  try {
    tokens = JSON.parse(tokensJson) as Credentials;
  } catch {
    throw new Error('DRIVE_OAUTH_TOKENS is not valid JSON');
  }

  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    redirectUri
  );
  oauth2Client.setCredentials(tokens);

  return google.drive({ version: 'v3', auth: oauth2Client });
}
