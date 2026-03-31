import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getAuthorizationUrl, exchangeCode } from '../../player/spotify/spotify.auth.js';
import { config } from '../../config.js';
import { saveToken } from '../../storage/token.store.js';
import { buildApiClient, getAuthProvider } from '../../triggers/twitch/twitch.auth.js';
import { ensureRewardExists } from '../../triggers/twitch/twitch.rewards.js';

const TWITCH_SCOPES = 'channel:read:redemptions channel:manage:redemptions';

type CallbackQuery = { Querystring: { code?: string; error?: string } };

// --- Публичные обработчики (вызываются напрямую из server.ts) ---

export async function spotifyCallback(
  req: FastifyRequest<CallbackQuery>,
  reply: FastifyReply
): Promise<void> {
  if (req.query.error) {
    return reply.view('callback', {
      title: 'Spotify',
      success: false,
      message: `Spotify отклонил авторизацию: ${req.query.error}`,
    });
  }

  if (!req.query.code) {
    return reply.view('callback', {
      title: 'Spotify',
      success: false,
      message: 'Отсутствует код авторизации',
    });
  }

  try {
    await exchangeCode(req.query.code);
    return reply.view('callback', {
      title: 'Spotify',
      success: true,
      message: 'Spotify успешно подключён',
    });
  } catch (err) {
    return reply.view('callback', {
      title: 'Spotify',
      success: false,
      message: String(err),
    });
  }
}

export async function twitchCallback(
  req: FastifyRequest<CallbackQuery>,
  reply: FastifyReply,
  onAuthorized?: () => Promise<void>
): Promise<void> {
  if (req.query.error) {
    return reply.view('callback', {
      title: 'Twitch',
      success: false,
      message: `Twitch отклонил авторизацию: ${req.query.error}`,
    });
  }

  if (!req.query.code) {
    return reply.view('callback', {
      title: 'Twitch',
      success: false,
      message: 'Отсутствует код авторизации',
    });
  }

  try {
    const res = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: config.twitch.clientId,
        client_secret: config.twitch.clientSecret,
        code: req.query.code,
        grant_type: 'authorization_code',
        redirect_uri: `${config.baseUrl}/auth/twitch/callback`,
      }),
    });

    if (!res.ok) throw new Error(`Twitch token error: ${res.status}`);

    const data = await res.json() as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };

    // Проверяем, что авторизовался именно стример (TWITCH_USER_ID)
    const validateRes = await fetch('https://id.twitch.tv/oauth2/validate', {
      headers: { Authorization: `OAuth ${data.access_token}` },
    });
    if (!validateRes.ok) throw new Error(`Twitch validate error: ${validateRes.status}`);
    const validateData = await validateRes.json() as { user_id: string; login: string };

    if (validateData.user_id !== config.twitch.userId) {
      return reply.view('callback', {
        title: 'Twitch',
        success: false,
        message: `Авторизован аккаунт "${validateData.login}" (ID: ${validateData.user_id}), но ожидается ID: ${config.twitch.userId}. Войдите под правильным аккаунтом.`,
      });
    }

    saveToken({
      provider: 'twitch',
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    });

    getAuthProvider().addUser(config.twitch.userId, {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
      obtainmentTimestamp: Date.now(),
      scope: TWITCH_SCOPES.split(' '),
    });

    const apiClient = buildApiClient();
    await ensureRewardExists(apiClient);

    await onAuthorized?.().catch(err =>
      console.warn('[Twitch] Ошибка запуска триггера после авторизации:', err)
    );

    return reply.view('callback', {
      title: 'Twitch',
      success: true,
      message: 'Twitch успешно подключён, награда создана в Channel Points',
    });
  } catch (err) {
    return reply.view('callback', {
      title: 'Twitch',
      success: false,
      message: String(err),
    });
  }
}

// --- Защищённые маршруты (инициация OAuth) ---

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.get('/auth/spotify', async (_req, reply) => {
    return reply.redirect(getAuthorizationUrl());
  });

  app.get('/auth/twitch', async (_req, reply) => {
    const params = new URLSearchParams({
      client_id: config.twitch.clientId,
      redirect_uri: `${config.baseUrl}/auth/twitch/callback`,
      response_type: 'code',
      scope: TWITCH_SCOPES,
    });
    return reply.redirect(`https://id.twitch.tv/oauth2/authorize?${params}`);
  });
}
