import 'dotenv/config';
import { initStorage } from './storage/token.store.js';
import { SpotifyPlayer } from './player/spotify/spotify.player.js';
import { TwitchTrigger } from './triggers/twitch/twitch.trigger.js';
import { QueueService } from './queue/queue.service.js';
import { startServer } from './web/server.js';

async function main() {
  // 1. Инициализация хранилища
  initStorage();
  console.log('[App] Хранилище инициализировано');

  // 2. Запуск веб-сервера (OAuth callbacks + UI)
  await startServer();
  console.log('[App] Веб-сервер запущен');

  // 3. Инициализация плеера и сервиса очереди
  const player = new SpotifyPlayer();
  const queueService = new QueueService(player);

  // 4. Запуск Twitch триггера
  const trigger = new TwitchTrigger();
  await trigger.start(async (event) => {
    console.log(`[Queue] Запрос от ${event.requestedBy}: ${event.query}`);
    const result = await queueService.handle({
      query: event.query,
      requestedBy: event.requestedBy,
    });
    console.log(`[Queue] ${result.success ? '✓' : '✗'} ${result.message}`);
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log('[App] Завершение работы...');
    await trigger.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('[App] Критическая ошибка:', err);
  process.exit(1);
});
