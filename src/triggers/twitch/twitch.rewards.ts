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
  try {
    const reward = await apiClient.channelPoints.createCustomReward(config.twitch.userId, {
      title: DEFAULT_TITLE,
      cost: DEFAULT_COST,
      isEnabled: false,
      userInputRequired: true,
      prompt: 'Вставь ссылку на Spotify или название трека',
    });

    saveReward({ rewardId: reward.id, rewardTitle: reward.title });
    console.log(`[Twitch] Награда создана: "${reward.title}" (${reward.id})`);

    return reward.id;
  } catch (err: unknown) {
    const body = (err as { body?: { message?: string } })?.body;
    if (body?.message !== 'CREATE_CUSTOM_REWARD_DUPLICATE_REWARD') throw err;

    // Награда уже существует — ищем по заголовку
    console.warn('[Twitch] Награда уже существует, ищем по заголовку...');
    // getCustomRewards возвращает все награды канала, manageable=true — только созданные этим приложением
    const allRewards = await apiClient.channelPoints.getCustomRewards(config.twitch.userId, true);
    const found = allRewards.find(r => r.title === DEFAULT_TITLE);
    if (!found) throw new Error(`Награда "${DEFAULT_TITLE}" не найдена после ошибки дублирования`);

    saveReward({ rewardId: found.id, rewardTitle: found.title });
    console.log(`[Twitch] Найдена существующая награда: "${found.title}" (${found.id})`);
    return found.id;
  }
}
