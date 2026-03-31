import { RefreshingAuthProvider } from '@twurple/auth';
import { ApiClient } from '@twurple/api';
import { config } from '../../config.js';
import { saveToken, getToken } from '../../storage/token.store.js';

let authProvider: RefreshingAuthProvider | null = null;
let apiClient: ApiClient | null = null;

export function buildApiClient(): ApiClient {
  if (apiClient) return apiClient;

  authProvider = new RefreshingAuthProvider({
    clientId: config.twitch.clientId,
    clientSecret: config.twitch.clientSecret,
  });

  authProvider.onRefresh((userId, token) => {
    saveToken({
      provider: 'twitch',
      accessToken: token.accessToken,
      refreshToken: token.refreshToken ?? null,
      expiresAt: token.expiresIn ? Date.now() + token.expiresIn * 1000 : null,
    });
  });

  const stored = getToken('twitch');
  if (stored) {
    authProvider.addUser(config.twitch.userId, {
      accessToken: stored.accessToken,
      refreshToken: stored.refreshToken ?? null,
      expiresIn: stored.expiresAt ? Math.floor((stored.expiresAt - Date.now()) / 1000) : null,
      obtainmentTimestamp: stored.expiresAt ? stored.expiresAt - 3600_000 : Date.now(),
      scope: ['channel:read:redemptions'],
    });
  }

  apiClient = new ApiClient({ authProvider });
  return apiClient;
}

export function getAuthProvider(): RefreshingAuthProvider {
  buildApiClient(); // инициализирует authProvider как побочный эффект
  if (!authProvider) throw new Error('AuthProvider not initialized');
  return authProvider;
}

export function isTwitchAuthorized(): boolean {
  return getToken('twitch') !== undefined;
}
