import type { FastifyInstance } from 'fastify';
import { getSettings, saveSettings } from '../../storage/token.store.js';
import { getToken } from '../../storage/token.store.js';

export async function settingsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/setup', async (_req, reply) => {
    return reply.view('setup', {
      title: 'Подключение',
      twitchOk: !!getToken('twitch'),
      spotifyOk: !!getToken('spotify'),
    });
  });

  app.get('/settings', async (_req, reply) => {
    return reply.view('settings', {
      title: 'Настройки',
      settings: getSettings(),
    });
  });

  app.post<{
    Body: { filterExplicit?: string; maxDurationSeconds?: string };
  }>('/settings', async (req, reply) => {
    const maxDuration = parseInt(req.body.maxDurationSeconds ?? '0', 10);

    saveSettings({
      filterExplicit: req.body.filterExplicit === 'true',
      maxDurationSeconds: maxDuration > 0 ? maxDuration : null,
    });

    return reply.redirect('/settings');
  });
}
