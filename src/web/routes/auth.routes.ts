import type { FastifyInstance } from 'fastify';
import { getAuthorizationUrl, exchangeCode } from '../../player/spotify/spotify.auth.js';
import { config } from '../../config.js';
import { saveToken } from '../../storage/token.store.js';
import { getAuthProvider } from '../../triggers/twitch/twitch.auth.js';

// Twitch OAuth scopes
const TWITCH_SCOPES = 'channel:read:redemptions';

export async function authRoutes(app: FastifyInstance): Promise<void> {
  // --- Spotify ---
  app.get('/auth/spotify', async (_req, reply) => {
    return reply.redirect(getAuthorizationUrl());
  });

  app.get<{ Querystring: { code?: string; error?: string } }>(
    '/auth/spotify/callback',
    async (req, reply) => {
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
  );

  // --- Twitch ---
  app.get('/auth/twitch', async (_req, reply) => {
    const params = new URLSearchParams({
      client_id: config.twitch.clientId,
      redirect_uri: `${config.baseUrl}/auth/twitch/callback`,
      response_type: 'code',
      scope: TWITCH_SCOPES,
    });
    return reply.redirect(`https://id.twitch.tv/oauth2/authorize?${params}`);
  });

  app.get<{ Querystring: { code?: string; error?: string } }>(
    '/auth/twitch/callback',
    async (req, reply) => {
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

        saveToken({
          provider: 'twitch',
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          expiresAt: Date.now() + data.expires_in * 1000,
        });

        // Добавляем пользователя в authProvider если он уже создан
        getAuthProvider().addUser(config.twitch.userId, {
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          expiresIn: data.expires_in,
          obtainmentTimestamp: Date.now(),
          scope: [TWITCH_SCOPES],
        });

        return reply.view('callback', {
          title: 'Twitch',
          success: true,
          message: 'Twitch успешно подключён',
        });
      } catch (err) {
        return reply.view('callback', {
          title: 'Twitch',
          success: false,
          message: String(err),
        });
      }
    }
  );
}
