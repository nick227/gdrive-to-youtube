// src/routes/channels.ts
import { Router } from 'express';
import prisma from '../prismaClient';
import {
  getAuthUrl,
  getTokensFromCode,
  getOAuthCredentials,
} from '../utils/youtubeAuth';
import { google } from 'googleapis';

const router = Router();

// GET /channels/auth-url?userId=1
router.get('/auth-url', (req, res) => {
  const userId = req.query.userId as string;
  if (!userId) {
    return res.status(400).json({ error: 'userId query parameter required' });
  }

  const state = JSON.stringify({ userId });
  const authUrl = getAuthUrl(state);

  console.log('state', state)

  // Redirect user straight to Google OAuth consent screen
  res.redirect(authUrl);
});

// GET /channels/callback
router.get('/callback', async (req, res) => {
  try {
    const { code, state, error } = req.query;

    if (error) {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      return res.redirect(
        `${frontendUrl}?error=${encodeURIComponent(error as string)}`
      );
    }

    if (!code) {
      return res.status(400).json({ error: 'No authorization code provided' });
    }

    // Exchange code for tokens
    let tokens;
    try {
      tokens = await getTokensFromCode(code as string);
      const { redirectUri } = getOAuthCredentials();
      console.log('[OAuth] getTokens success', {
        redirectUri,
        hasAccess: !!tokens.access_token,
        hasRefresh: !!tokens.refresh_token,
        scope: tokens.scope,
        expiry: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
      });
    } catch (tokenErr) {
      console.error('[OAuth] getTokens failed', {
        message: tokenErr instanceof Error ? tokenErr.message : String(tokenErr),
        stack: tokenErr instanceof Error ? tokenErr.stack : undefined,
      });
      return res.status(500).json({ error: 'Failed to process OAuth callback', detail: 'token_exchange_failed' });
    }

    if (!tokens.access_token) {
      console.error('[OAuth] missing access_token', {
        hasRefresh: !!tokens.refresh_token,
        scope: tokens.scope,
      });
      return res.status(400).json({ error: 'Failed to obtain access token', detail: 'missing_access_token' });
    }

    const accessToken = tokens.access_token;
    const newRefreshToken = tokens.refresh_token || null;
    const tokenExpiresAt = tokens.expiry_date ? new Date(tokens.expiry_date) : null;

    // Build OAuth client
    const { clientId, clientSecret, redirectUri } = getOAuthCredentials();
    const auth = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

    auth.setCredentials({
      access_token: accessToken,
      refresh_token: newRefreshToken || undefined,
    });

    // Get the user's YouTube channel
    let channel;
    try {
      const youtube = google.youtube({ version: 'v3', auth });
      const channelsResponse = await youtube.channels.list({
        part: ['snippet'],
        mine: true,
      });
      channel = channelsResponse.data.items?.[0];
      console.log('[OAuth] channels.list result', {
        found: !!channel?.id,
        channelId: channel?.id,
        title: channel?.snippet?.title,
      });
    } catch (ytErr) {
      console.error('[OAuth] channels.list failed', {
        message: ytErr instanceof Error ? ytErr.message : String(ytErr),
        stack: ytErr instanceof Error ? ytErr.stack : undefined,
      });
      return res.status(500).json({ error: 'Failed to process OAuth callback', detail: 'channels_list_failed' });
    }

    if (!channel || !channel.id) {
      console.error('[OAuth] channels.list returned no channel');
      return res.status(400).json({ error: 'No channel found', detail: 'no_channel' });
    }

    // Recover userId from state
    let userId: number | null = null;
    if (state) {
      try {
        const stateData = JSON.parse(state as string);
        userId = parseInt(stateData.userId, 10) || null;
      } catch {
        // Ignore parse errors
      }
    }
    if (!userId) {
      console.error('[OAuth] missing userId in state', { state });
      return res.status(400).json({ error: 'Missing user context in OAuth state', detail: 'missing_user' });
    }

    const channelId = channel.id;
    const title = channel.snippet?.title || null;

    // Upsert YouTube channel (metadata only)
    await prisma.youtubeChannel.upsert({
      where: { channelId },
      create: { channelId, title },
      update: { title },
    });

    // Upsert link for this user+channel with tokens
    await prisma.youtubeChannelLink.upsert({
      where: { userId_channelId: { userId, channelId } },
      create: {
        userId,
        channelId,
        accessToken,
        refreshToken: newRefreshToken,
        tokenExpiresAt,
        scopes: tokens.scope || null,
      },
      update: {
        accessToken,
        refreshToken: newRefreshToken || undefined,
        tokenExpiresAt,
        scopes: tokens.scope || null,
      },
    });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    return res.redirect(`${frontendUrl}?channelAdded=true`);
  } catch (err) {
    console.error('OAuth callback error:', {
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    return res.redirect(
      `${frontendUrl}?error=${encodeURIComponent('oauth_callback_failed')}`
    );
  }
});

// GET /channels
router.get('/', async (_req, res) => {
  try {
    const channels = await prisma.youtubeChannel.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return res.json(channels);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to fetch channels' });
  }
});

// GET /channels/:id
router.get('/:id', async (req, res) => {
  try {
    const channel = await prisma.youtubeChannel.findUnique({
      where: { id: parseInt(req.params.id, 10) },
    });

    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    return res.json(channel);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to fetch channel' });
  }
});

export default router;
