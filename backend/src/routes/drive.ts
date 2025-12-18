import { Router } from 'express';
import crypto from 'node:crypto';
import { google } from 'googleapis';
import { DriveConnectionStatus } from '@prisma/client';
import prisma from '../prismaClient';
import { getCurrentUser } from '../auth/middleware';
import {
  encryptTokensForStorage,
  refreshConnectionIfNeeded,
  markDriveConnectionStatus,
} from '../utils/driveConnectionClient';

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive';
const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const DEFAULT_FOLDER_NAME = process.env.DRIVE_DEFAULT_FOLDER_NAME || 'App Uploads';
const PUBLIC_URL = process.env.PUBLIC_URL || 'http://localhost:4000';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

const router = Router();

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

function extractFolderId(input?: string | null): string | null {
  if (!input) return null;
  // Direct ID
  if (/^[a-zA-Z0-9_-]{10,}$/.test(input)) return input;

  // Folder URL patterns
  const folderMatch = input.match(/\/folders\/([a-zA-Z0-9_-]{10,})/);
  if (folderMatch) return folderMatch[1];

  const idParam = input.match(/[?&]id=([a-zA-Z0-9_-]{10,})/);
  if (idParam) return idParam[1];

  return null;
}

function sanitizeRedirectAfter(input: string | null | undefined): string | null {
  if (!input) return null;
  if (!input.startsWith('/')) return null;
  if (input.startsWith('//')) return null; // protocol-relative -> disallow
  return input;
}

function sanitizeConnection(connection: {
  id: string;
  userId: number;
  driveAccountEmail: string;
  scopes: string;
  status: DriveConnectionStatus;
  lastError: string | null;
  rootFolderId: string;
  rootFolderName: string;
  rootFolderLink: string;
  tokenExpiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: connection.id,
    userId: connection.userId,
    driveAccountEmail: connection.driveAccountEmail,
    scopes: connection.scopes,
    status: connection.status,
    lastError: connection.lastError,
    rootFolderId: connection.rootFolderId,
    rootFolderName: connection.rootFolderName,
    rootFolderLink: connection.rootFolderLink,
    tokenExpiresAt: connection.tokenExpiresAt ? connection.tokenExpiresAt.toISOString() : null,
    createdAt: connection.createdAt.toISOString(),
    updatedAt: connection.updatedAt.toISOString(),
  };
}

async function loadConnectionForUser(userId: number, connectionId: string) {
  const connection = await prisma.driveConnection.findUnique({
    where: { id: connectionId },
  });

  if (!connection || connection.userId !== userId) {
    return null;
  }

  return connection;
}

function isInvalidGrantError(err: unknown) {
  const data = (err as { response?: { data?: { error?: string }; status?: number } })?.response;
  return data?.data?.error === 'invalid_grant' || data?.status === 401;
}

async function markError(connectionId: string, err: unknown) {
  const status = isInvalidGrantError(err)
    ? DriveConnectionStatus.REVOKED
    : DriveConnectionStatus.ERROR;
  await markDriveConnectionStatus(connectionId, status, String(err));
}

router.get('/auth-url', async (req, res) => {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const requestedFolderId = extractFolderId((req.query.requestedFolderId as string) || null);
    const redirectAfter = sanitizeRedirectAfter(req.query.redirectAfter as string);
    const state = crypto.randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + STATE_TTL_MS);

    await prisma.driveConsentState.create({
      data: {
        state,
        userId: user.id,
        nonce: crypto.randomUUID(),
        redirectAfter,
        requestedFolderId: requestedFolderId || undefined,
        expiresAt,
      },
    });

    const client = getOAuthClient();
    const url = client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [DRIVE_SCOPE],
      state,
    });

    const mode = (req.query.mode as string) || 'json';
    if (mode === 'redirect') {
      return res.redirect(url);
    }

    return res.json({ url, state, expiresAt: expiresAt.toISOString() });
  } catch (err) {
    console.error('[drive] auth-url error', err);
    return res.status(500).json({ error: 'Failed to create auth URL' });
  }
});

router.get('/callback', async (req, res) => {
  try {
    const { state, code, error } = req.query;

    if (error) {
      return res.redirect(`${FRONTEND_URL}?error=${encodeURIComponent(String(error))}`);
    }

    if (!state || typeof state !== 'string') {
      return res.redirect(`${FRONTEND_URL}?error=drive_state_missing`);
    }

    const consent = await prisma.driveConsentState.findUnique({ where: { state } });
    if (!consent || consent.expiresAt.getTime() < Date.now()) {
      if (consent) {
        await prisma.driveConsentState.delete({ where: { state } });
      }
      return res.redirect(`${FRONTEND_URL}?error=drive_state_invalid`);
    }

    if (!code || typeof code !== 'string') {
      return res.redirect(`${FRONTEND_URL}?error=drive_code_missing`);
    }

    const client = getOAuthClient();

    let tokens;
    try {
      const { tokens: fetched } = await client.getToken(code);
      tokens = fetched;
    } catch (tokenErr) {
      console.error('[drive] token exchange failed', tokenErr);
      return res.redirect(`${FRONTEND_URL}?error=drive_token_exchange_failed`);
    }

    client.setCredentials(tokens);
    const drive = google.drive({ version: 'v3', auth: client });

    let driveAccountEmail = 'unknown';
    try {
      const about = await drive.about.get({ fields: 'user(emailAddress)' });
      driveAccountEmail = about.data.user?.emailAddress || driveAccountEmail;
    } catch (aboutErr) {
      console.warn('[drive] about.get failed', aboutErr);
    }

    let rootFolderId = consent.requestedFolderId || null;
    let rootFolderName = DEFAULT_FOLDER_NAME;
    let rootFolderLink = '';

    if (rootFolderId) {
      try {
        const folder = await drive.files.get({
          fileId: rootFolderId,
          fields: 'id,name,mimeType,webViewLink',
          supportsAllDrives: true,
        });

        if (folder.data.mimeType !== 'application/vnd.google-apps.folder') {
          return res.redirect(`${FRONTEND_URL}?error=drive_folder_invalid`);
        }

        rootFolderName = folder.data.name || rootFolderName;
        rootFolderLink =
          folder.data.webViewLink || `https://drive.google.com/drive/folders/${rootFolderId}`;
      } catch (folderErr) {
        console.error('[drive] validate requested folder failed', folderErr);
        const reason =
          (folderErr as { response?: { data?: { error?: { reason?: string } } } }).response?.data
            ?.error?.reason;
        const code =
          (folderErr as { code?: number }).code ||
          (folderErr as { response?: { status?: number } }).response?.status;
        const detail =
          reason === 'notFound' || code === 404
            ? 'drive_folder_not_found_or_no_access'
            : 'drive_folder_unreachable';
        return res.redirect(`${FRONTEND_URL}?error=${detail}`);
      }
    } else {
      const created = await drive.files.create({
        requestBody: {
          name: DEFAULT_FOLDER_NAME,
          mimeType: 'application/vnd.google-apps.folder',
        },
        fields: 'id,name,webViewLink',
        supportsAllDrives: true,
      });

      if (!created.data.id) {
        return res.redirect(`${FRONTEND_URL}?error=drive_folder_create_failed`);
      }

      rootFolderId = created.data.id;
      rootFolderName = created.data.name || DEFAULT_FOLDER_NAME;
      rootFolderLink =
        created.data.webViewLink || `https://drive.google.com/drive/folders/${rootFolderId}`;
    }

    // Enforce single connection per user by revoking old ones
    await prisma.driveConnection.updateMany({
      where: { userId: consent.userId },
      data: {
        status: DriveConnectionStatus.REVOKED,
        accessToken: null,
        refreshToken: null,
        tokenExpiresAt: null,
        lastError: 'superseded',
      },
    });

    const encrypted = encryptTokensForStorage(tokens.access_token || null, tokens.refresh_token || null);

    const connection = await prisma.driveConnection.create({
      data: {
        userId: consent.userId,
        driveAccountEmail,
        scopes: tokens.scope || DRIVE_SCOPE,
        status: DriveConnectionStatus.ACTIVE,
        lastError: null,
        rootFolderId,
        rootFolderName,
        rootFolderLink,
        accessToken: encrypted.accessToken,
        refreshToken: encrypted.refreshToken,
        tokenExpiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      },
    });

    await prisma.driveConsentState.delete({ where: { state } });

    const redirectTarget =
      sanitizeRedirectAfter(consent.redirectAfter) ||
      `${FRONTEND_URL}?driveConnectionId=${encodeURIComponent(connection.id)}`;

    return res.redirect(redirectTarget);
  } catch (err) {
    console.error('[drive] callback error', err);
    return res.redirect(`${FRONTEND_URL}?error=drive_callback_error`);
  }
});

router.get('/connections', async (req, res) => {
  const user = getCurrentUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const connections = await prisma.driveConnection.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
  });

  return res.json(connections.map(sanitizeConnection));
});

router.get('/connections/:id/users', async (req, res) => {
  const user = getCurrentUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const connection = await prisma.driveConnection.findUnique({
      where: { id: req.params.id },
    });

    if (!connection || connection.userId !== user.id) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    // Users who have a connection pointing at the same root folder (active or errored but not revoked).
    const users = await prisma.user.findMany({
      where: {
        driveConnections: {
          some: {
            rootFolderId: connection.rootFolderId,
            status: { not: DriveConnectionStatus.REVOKED },
          },
        },
      },
      select: { id: true, email: true, name: true },
      orderBy: { createdAt: 'desc' },
    });

    res.json(users);
  } catch (err) {
    console.error('[drive] list users error', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

router.patch('/connections/:id/folder', async (req, res) => {
  try {
    const user = getCurrentUser(req);
    if (!user) return res.status(401).json({ error: 'Authentication required' });

    const connection = await loadConnectionForUser(user.id, req.params.id);
    if (!connection) return res.status(404).json({ error: 'Connection not found' });

    const folderInput =
      (req.body?.folder as string) ||
      (req.body?.folderId as string) ||
      (req.body?.folderUrl as string);
    const folderId = extractFolderId(folderInput);

    if (!folderId) return res.status(400).json({ error: 'Invalid folder id/url' });

    const { drive, connection: fresh } = await refreshConnectionIfNeeded(connection);

    let folder;
    try {
      folder = await drive.files.get({
        fileId: folderId,
        fields: 'id,name,mimeType,webViewLink',
        supportsAllDrives: true,
      });
    } catch (err) {
      await markError(fresh.id, err);
      return res.status(401).json({ error: 'Folder not accessible with current tokens' });
    }

    if (folder.data.mimeType !== 'application/vnd.google-apps.folder') {
      return res.status(400).json({ error: 'Provided id is not a folder' });
    }

    const updated = await prisma.driveConnection.update({
      where: { id: fresh.id },
      data: {
        rootFolderId: folderId,
        rootFolderName: folder.data.name || fresh.rootFolderName,
        rootFolderLink:
          folder.data.webViewLink || `https://drive.google.com/drive/folders/${folderId}`,
        status: DriveConnectionStatus.ACTIVE,
        lastError: null,
      },
    });

    return res.json(sanitizeConnection(updated));
  } catch (err) {
    console.error('[drive] update folder error', err);
    return res.status(500).json({ error: 'Failed to update folder' });
  }
});

router.delete('/connections/:id', async (req, res) => {
  try {
    const user = getCurrentUser(req);
    if (!user) return res.status(401).json({ error: 'Authentication required' });

    const connection = await loadConnectionForUser(user.id, req.params.id);
    if (!connection) return res.status(404).json({ error: 'Connection not found' });

    await prisma.driveConnection.update({
      where: { id: connection.id },
      data: {
        status: DriveConnectionStatus.REVOKED,
        accessToken: null,
        refreshToken: null,
        tokenExpiresAt: null,
        lastError: 'revoked_by_user',
      },
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error('[drive] revoke error', err);
    return res.status(500).json({ error: 'Failed to revoke connection' });
  }
});

router.post('/connections/:id/refresh', async (req, res) => {
  try {
    const user = getCurrentUser(req);
    if (!user) return res.status(401).json({ error: 'Authentication required' });

    const connection = await loadConnectionForUser(user.id, req.params.id);
    if (!connection) return res.status(404).json({ error: 'Connection not found' });

    if (!connection.refreshToken) {
      return res.status(400).json({ error: 'No refresh token available' });
    }

    const { connection: refreshed } = await refreshConnectionIfNeeded(connection);

    return res.json({
      ok: true,
      status: refreshed.status,
      tokenExpiresAt: refreshed.tokenExpiresAt
        ? refreshed.tokenExpiresAt.toISOString()
        : null,
    });
  } catch (err) {
    console.error('[drive] manual refresh error', err);
    await markError(req.params.id, err);
    return res.status(500).json({ error: 'Failed to refresh tokens' });
  }
});

router.post('/connections/:id/folders', async (req, res) => {
  try {
    const user = getCurrentUser(req);
    if (!user) return res.status(401).json({ error: 'Authentication required' });

    const connection = await loadConnectionForUser(user.id, req.params.id);
    if (!connection) return res.status(404).json({ error: 'Connection not found' });

    const name = (req.body?.name as string) || DEFAULT_FOLDER_NAME;
    const { drive } = await refreshConnectionIfNeeded(connection);

    let created;
    try {
      created = await drive.files.create({
        requestBody: {
          name,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [connection.rootFolderId],
        },
        fields: 'id,name,webViewLink',
        supportsAllDrives: true,
      });
    } catch (err) {
      await markError(connection.id, err);
      return res.status(401).json({ error: 'Failed to create folder; tokens may be invalid' });
    }

    if (!created.data.id) {
      return res.status(500).json({ error: 'Failed to create folder' });
    }

    return res.json({
      id: created.data.id,
      name: created.data.name || name,
      link:
        created.data.webViewLink ||
        `https://drive.google.com/drive/folders/${created.data.id}`,
    });
  } catch (err) {
    console.error('[drive] create child folder error', err);
    return res.status(500).json({ error: 'Failed to create child folder' });
  }
});

router.post('/folder/resolve', async (req, res) => {
  try {
    const user = getCurrentUser(req);
    if (!user) return res.status(401).json({ error: 'Authentication required' });

    const folderInput =
      (req.body?.folder as string) ||
      (req.body?.folderId as string) ||
      (req.body?.folderUrl as string);
    const folderId = extractFolderId(folderInput);
    const driveConnectionId = req.body?.driveConnectionId as string;

    if (!folderId || !driveConnectionId) {
      return res.status(400).json({ error: 'driveConnectionId and folder are required' });
    }

    const connection = await loadConnectionForUser(user.id, driveConnectionId);
    if (!connection) return res.status(404).json({ error: 'Connection not found' });

    const { drive, connection: fresh } = await refreshConnectionIfNeeded(connection);

    let folder;
    try {
      folder = await drive.files.get({
        fileId: folderId,
        fields: 'id,name,mimeType,webViewLink',
        supportsAllDrives: true,
      });
    } catch (err) {
      const reason =
        (err as { response?: { data?: { error?: { reason?: string } } } }).response?.data?.error
          ?.reason;
      const code =
        (err as { code?: number }).code ||
        (err as { response?: { status?: number } }).response?.status;
      const detail =
        reason === 'notFound' || code === 404
          ? 'drive_folder_not_found_or_no_access'
          : 'drive_folder_unreachable';
      await markError(fresh.id, err);
      return res.status(401).json({ error: detail });
    }

    if (folder.data.mimeType !== 'application/vnd.google-apps.folder') {
      return res.status(400).json({ error: 'Provided id is not a folder' });
    }

    return res.json({
      id: folderId,
      name: folder.data.name || 'Drive Folder',
      link: folder.data.webViewLink || `https://drive.google.com/drive/folders/${folderId}`,
    });
  } catch (err) {
    console.error('[drive] resolve folder error', err);
    return res.status(500).json({ error: 'Failed to resolve folder' });
  }
});

export default router;
