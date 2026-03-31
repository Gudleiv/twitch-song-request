import Fastify from 'fastify';
import fastifyView from '@fastify/view';
import fastifyStatic from '@fastify/static';
import fastifyFormbody from '@fastify/formbody';
import { Eta } from 'eta';
import path from 'path';
import { fileURLToPath } from 'url';
import { authRoutes } from './routes/auth.routes.js';
import { settingsRoutes } from './routes/settings.routes.js';
import { config } from '../config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function buildServer() {
  const app = Fastify({ logger: true });

  const eta = new Eta({ views: path.join(__dirname, 'templates') });

  await app.register(fastifyFormbody);

  await app.register(fastifyView, {
    engine: { eta },
    root: path.join(__dirname, 'templates'),
    layout: 'layout',
  });

  await app.register(fastifyStatic, {
    root: path.join(__dirname, 'static'),
    prefix: '/static/',
  });

  await app.register(authRoutes);
  await app.register(settingsRoutes);

  app.get('/', async (_req, reply) => reply.redirect('/setup'));

  return app;
}

export async function startServer(): Promise<void> {
  const app = await buildServer();
  await app.listen({ port: config.port, host: '0.0.0.0' });
}
