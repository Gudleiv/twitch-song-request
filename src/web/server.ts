import Fastify from 'fastify';
import fastifyView from '@fastify/view';
import fastifyStatic from '@fastify/static';
import fastifyFormbody from '@fastify/formbody';
import fastifyBasicAuth from '@fastify/basic-auth';
import { Eta } from 'eta';
import path from 'path';
import { fileURLToPath } from 'url';
import { authRoutes, twitchCallback, spotifyCallback } from './routes/auth.routes.js';
import { settingsRoutes } from './routes/settings.routes.js';
import { config } from '../config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function buildServer(onTwitchAuthorized: () => Promise<void>) {
  const app = Fastify({ logger: true });

  await app.register(fastifyFormbody);

  await app.register(fastifyView, {
    engine: { eta: new Eta({ views: path.join(__dirname, 'templates') }) },
    root: path.join(__dirname, 'templates'),
    layout: 'layout',
  });

  await app.register(fastifyStatic, {
    root: path.join(__dirname, 'static'),
    prefix: '/static/',
  });

  await app.register(fastifyBasicAuth, {
    validate(username, password, _req, _reply, done) {
      if (username === 'admin' && password === config.adminPassword) {
        done();
      } else {
        done(new Error('Unauthorized'));
      }
    },
    authenticate: { realm: 'Song Request Admin' },
  });

  // Публичные маршруты — OAuth callbacks (редиректят сюда Twitch/Spotify без нашей авторизации)
  app.get<{ Querystring: { code?: string; error?: string } }>(
    '/auth/twitch/callback',
    (req, reply) => twitchCallback(req, reply, onTwitchAuthorized)
  );
  app.get<{ Querystring: { code?: string; error?: string } }>(
    '/auth/spotify/callback',
    (req, reply) => spotifyCallback(req, reply)
  );

  // Защищённые маршруты — требуют Basic Auth
  await app.register(async (priv) => {
    priv.addHook('preHandler', app.basicAuth);

    priv.get('/', async (_req, reply) => reply.redirect('/setup'));
    await priv.register(authRoutes);
    await priv.register(settingsRoutes);
  });

  return app;
}

export async function startServer(onTwitchAuthorized: () => Promise<void>) {
  const app = await buildServer(onTwitchAuthorized);
  await app.listen({ port: config.port, host: '0.0.0.0' });
  return app;
}
