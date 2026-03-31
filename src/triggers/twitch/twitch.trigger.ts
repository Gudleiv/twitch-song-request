import { EventSubWsListener } from '@twurple/eventsub-ws';
import type { BaseTrigger, SongRequestEvent } from '../base.trigger.js';
import { buildApiClient, isTwitchAuthorized } from './twitch.auth.js';
import { config } from '../../config.js';

export class TwitchTrigger implements BaseTrigger {
  private listener: EventSubWsListener | null = null;

  async start(onRequest: (event: SongRequestEvent) => Promise<void>): Promise<void> {
    if (!isTwitchAuthorized()) {
      console.warn('[Twitch] Не авторизован, триггер не запущен');
      return;
    }

    const apiClient = buildApiClient();
    this.listener = new EventSubWsListener({ apiClient });

    this.listener.onChannelRedemptionAdd(config.twitch.userId, (event) => {
      const query = event.input.trim();
      if (!query) return;

      void onRequest({
        query,
        requestedBy: event.userDisplayName,
      });
    });

    await this.listener.start();
    console.log('[Twitch] EventSub WS запущен');
  }

  async stop(): Promise<void> {
    await this.listener?.stop();
    this.listener = null;
    console.log('[Twitch] EventSub WS остановлен');
  }
}
