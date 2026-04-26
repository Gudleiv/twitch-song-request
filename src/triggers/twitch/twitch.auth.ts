import { RefreshingAuthProvider } from '@twurple/auth';
import { ApiClient } from '@twurple/api';
import { config } from '../../config.js';
import { saveToken, getToken, deleteToken } from '../../storage/token.store.js';

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
      scope: ['channel:read:redemptions', 'channel:manage:redemptions'],
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

export function resetTwitchAuth(): void {
  deleteToken('twitch');
  authProvider = null;
  apiClient = null;
}

export function isTwitchAuthError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const name = (err as { name?: string }).name;
  if (name === 'CachedRefreshFailureError' || name === 'InvalidTokenError') return true;
  const message = (err as { message?: string }).message ?? '';
  return /user context.*has been disabled|invalid (access|refresh) token|refresh.*fail/i.test(message);
}
