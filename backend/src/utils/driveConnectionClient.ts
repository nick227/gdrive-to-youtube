import { google, drive_v3 } from 'googleapis';
import { DriveConnection, DriveConnectionStatus } from '@prisma/client';
import prisma from '../prismaClient';
import { decryptSecret, encryptSecret } from './secret';

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const PUBLIC_URL = process.env.PUBLIC_URL || 'http://localhost:4000';

function getOAuthClient() {
  const clientId = process.env.DRIVE_CLIENT_ID;
  const clientSecret = process.env.DRIVE_CLIENT_SECRET;
  const redirectUri =
    process.env.DRIVE_REDIRECT_URI || `${PUBLIC_URL.replace(/\/?$/, '')}/drive/callback`;

  if (!clientId || !clientSecret) {
    throw new Error('Missing DRIVE_CLIENT_ID or DRIVE_CLIENT_SECRET');
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export function decryptTokens(connection: DriveConnection) {
  const attempt = (value: string | null) => {
    if (!value) return { token: null, wasPlain: false };
    try {
      return { token: decryptSecret(value), wasPlain: false };
    } catch {
      // Fallback for legacy plaintext tokens; mark as plain to allow re-encryption
      return { token: value, wasPlain: true };
    }
  };

  const access = attempt(connection.accessToken);
  const refresh = attempt(connection.refreshToken);

  return {
    accessToken: access.token,
    refreshToken: refresh.token,
    wasPlain: access.wasPlain || refresh.wasPlain,
  };
}

function googleDriveClientFromTokens(accessToken: string, refreshToken?: string | null) {
  const client = getOAuthClient();
  client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken || undefined,
    scope: DRIVE_SCOPE,
  });
  return { client, drive: google.drive({ version: 'v3', auth: client }) };
}

export async function refreshConnectionIfNeeded(connection: DriveConnection): Promise<{
  connection: DriveConnection;
  drive: drive_v3.Drive;
}> {
  const { accessToken, refreshToken, wasPlain } = decryptTokens(connection);

  if (!accessToken) {
    throw new Error('Connection has no access token');
  }

  const expiresSoon =
    !!refreshToken &&
    (!connection.tokenExpiresAt ||
      connection.tokenExpiresAt.getTime() <= Date.now() + 60_000);

  if (!expiresSoon) {
    const { drive } = googleDriveClientFromTokens(accessToken, refreshToken);
    if (wasPlain) {
      await prisma.driveConnection.update({
        where: { id: connection.id },
        data: {
          accessToken: encryptSecret(accessToken),
          refreshToken: encryptSecret(refreshToken),
        },
      });
    }
    return { connection, drive };
  }

  const oauth2Client = getOAuthClient();
  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken || undefined,
  });

  try {
    const { credentials } = await oauth2Client.refreshAccessToken();
    const newAccess = credentials.access_token || accessToken;
    const newRefresh = credentials.refresh_token || refreshToken || null;
    const newExpiry = credentials.expiry_date ? new Date(credentials.expiry_date) : connection.tokenExpiresAt;

    const updated = await prisma.driveConnection.update({
      where: { id: connection.id },
      data: {
        accessToken: encryptSecret(newAccess),
        refreshToken: encryptSecret(newRefresh),
        tokenExpiresAt: newExpiry,
        status: DriveConnectionStatus.ACTIVE,
        lastError: null,
      },
    });

    const { drive } = googleDriveClientFromTokens(newAccess, newRefresh);
    return { connection: updated, drive };
  } catch (err) {
    const isInvalidGrant =
      typeof err === 'object' &&
      err !== null &&
      'response' in err &&
      (err as { response?: { data?: { error?: string } } }).response?.data?.error === 'invalid_grant';

    await prisma.driveConnection.update({
      where: { id: connection.id },
      data: {
        status: isInvalidGrant ? DriveConnectionStatus.REVOKED : DriveConnectionStatus.ERROR,
        lastError: String(err),
      },
    });
    throw err;
  }
}

export async function getDriveClientById(connectionId: string): Promise<{
  connection: DriveConnection;
  drive: drive_v3.Drive;
}> {
  const connection = await prisma.driveConnection.findUnique({ where: { id: connectionId } });
  if (!connection) {
    throw new Error('DriveConnection not found');
  }
  return refreshConnectionIfNeeded(connection);
}

export async function markDriveConnectionStatus(
  connectionId: string,
  status: DriveConnectionStatus,
  lastError?: string | null
) {
  await prisma.driveConnection.update({
    where: { id: connectionId },
    data: { status, lastError: lastError ?? null },
  });
}

export function encryptTokensForStorage(accessToken: string | null, refreshToken: string | null) {
  return {
    accessToken: encryptSecret(accessToken),
    refreshToken: encryptSecret(refreshToken),
  };
}
