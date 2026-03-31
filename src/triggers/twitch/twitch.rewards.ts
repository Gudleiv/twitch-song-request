import type { ApiClient } from '@twurple/api';
import { config } from '../../config.js';
import { saveReward, getReward } from '../../storage/token.store.js';

const DEFAULT_TITLE = '🎵 Song Request';
const DEFAULT_COST = 500;

export async function ensureRewardExists(apiClient: ApiClient): Promise<string> {
  const stored = getReward();

  // Проверяем, что сохранённая награда всё ещё существует на Twitch
  if (stored) {
    try {
      const reward = await apiClient.channelPoints.getCustomRewardById(
        config.twitch.userId,
        stored.rewardId
      );
      if (reward) {
        console.log(`[Twitch] Награда найдена: "${reward.title}" (${reward.id})`);
        return reward.id;
      }
    } catch {
      console.warn('[Twitch] Сохранённая награда не найдена на Twitch, создаём новую');
    }
  }

  // Создаём новую награду
  const reward = await apiClient.channelPoints.createCustomReward(config.twitch.userId, {
    title: DEFAULT_TITLE,
    cost: DEFAULT_COST,
    isEnabled: true,
    userInputRequired: true,
    prompt: 'Вставь ссылку на Spotify или название трека',
  });

  saveReward({ rewardId: reward.id, rewardTitle: reward.title });
  console.log(`[Twitch] Награда создана: "${reward.title}" (${reward.id})`);

  return reward.id;
}
