import { EventSubWsListener } from '@twurple/eventsub-ws';
import type { BaseTrigger, SongRequestEvent } from '../base.trigger.js';
import { buildApiClient, isTwitchAuthorized } from './twitch.auth.js';
import { ensureRewardExists } from './twitch.rewards.js';
import { config } from '../../config.js';

export interface SongRequestEventWithRedemption extends SongRequestEvent {
  redemptionId: string;
  rewardId: string;
}

export class TwitchTrigger implements BaseTrigger {
  private listener: EventSubWsListener | null = null;
  private rewardId: string | null = null;

  async start(
    onRequest: (
      event: SongRequestEventWithRedemption,
      fulfill: () => Promise<void>,
      cancel: () => Promise<void>
    ) => Promise<void>
  ): Promise<void> {
    if (!isTwitchAuthorized()) {
      console.warn('[Twitch] Не авторизован, триггер не запущен');
      return;
    }

    const apiClient = buildApiClient();
    this.rewardId = await ensureRewardExists(apiClient);

    this.listener = new EventSubWsListener({ apiClient });

    this.listener.onChannelRedemptionAdd(config.twitch.userId, (event) => {
      if (event.rewardId !== this.rewardId) return;

      const query = event.input.trim();
      if (!query) return;

      const fulfill = () =>
        apiClient.channelPoints.updateRedemptionStatusByIds(
          config.twitch.userId,
          event.rewardId,
          [event.id],
          'FULFILLED'
        ).then(() => undefined);

      const cancel = () =>
        apiClient.channelPoints.updateRedemptionStatusByIds(
          config.twitch.userId,
          event.rewardId,
          [event.id],
          'CANCELED'
        ).then(() => undefined);

      void onRequest(
        { query, requestedBy: event.userDisplayName, redemptionId: event.id, rewardId: event.rewardId },
        fulfill,
        cancel
      );
    });

    await this.listener.start();
    console.log(`[Twitch] EventSub WS запущен, rewardId: ${this.rewardId}`);
  }

  async stop(): Promise<void> {
    await this.listener?.stop();
    this.listener = null;
    console.log('[Twitch] EventSub WS остановлен');
  }
}
