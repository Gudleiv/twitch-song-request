import 'dotenv/config';
import { initStorage } from './storage/token.store.js';
import { SpotifyPlayer } from './player/spotify/spotify.player.js';
import { TwitchTrigger } from './triggers/twitch/twitch.trigger.js';
import { QueueService } from './queue/queue.service.js';
import { startServer } from './web/server.js';
import type { SongRequestEventWithRedemption } from './triggers/twitch/twitch.trigger.js';

async function main() {
  initStorage();
  console.log('[App] Хранилище инициализировано');

  const player = new SpotifyPlayer();
  const queueService = new QueueService(player);
  const trigger = new TwitchTrigger();

  const handleRequest = async (
    event: SongRequestEventWithRedemption,
    fulfill: () => Promise<void>,
    cancel: () => Promise<void>
  ) => {
    console.log(`[Queue] Запрос от ${event.requestedBy}: ${event.query}`);

    const result = await queueService.handle({
      query: event.query,
      requestedBy: event.requestedBy,
    });

    console.log(`[Queue] ${result.success ? '✓' : '✗'} ${result.message}`);

    if (result.success) {
      await fulfill().catch(err => console.warn('[Twitch] Ошибка подтверждения redemption:', err));
    } else {
      await cancel().catch(err => console.warn('[Twitch] Ошибка отмены redemption:', err));
    }
  };

  const startTrigger = () => trigger.start(handleRequest);

  const server = await startServer(startTrigger);
  console.log('[App] Веб-сервер запущен');

  await startTrigger();

  const shutdown = async () => {
    console.log('[App] Завершение работы...');
    await trigger.stop();
    await server.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('[App] Критическая ошибка:', err);
  process.exit(1);
});
