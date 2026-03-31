import type { BasePlayer } from '../player/base.player.js';
import { getSettings } from '../storage/token.store.js';

export interface QueueRequest {
  query: string;
  requestedBy: string;
}

export interface QueueResponse {
  success: boolean;
  message: string;
}

export class QueueService {
  constructor(private readonly player: BasePlayer) {}

  async handle(request: QueueRequest): Promise<QueueResponse> {
    if (!this.player.isAuthorized()) {
      return { success: false, message: 'Плеер не авторизован' };
    }

    const track = await this.player.resolve(request.query);
    if (!track) {
      return { success: false, message: `Трек не найден: ${request.query}` };
    }

    const settings = getSettings();

    if (settings.filterExplicit && track.explicit) {
      return { success: false, message: 'Трек содержит explicit-контент и не может быть добавлен' };
    }

    if (settings.maxDurationSeconds !== null) {
      const trackDurationSec = Math.floor(track.durationMs / 1000);
      if (trackDurationSec > settings.maxDurationSeconds) {
        const max = formatDuration(settings.maxDurationSeconds);
        const actual = formatDuration(trackDurationSec);
        return {
          success: false,
          message: `Трек слишком длинный: ${actual} (максимум ${max})`,
        };
      }
    }

    const result = await this.player.enqueue(track);
    if (!result.success) {
      return { success: false, message: result.error ?? 'Ошибка добавления в очередь' };
    }

    return {
      success: true,
      message: `Добавлено: ${track.title} — ${track.artist}`,
    };
  }
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
