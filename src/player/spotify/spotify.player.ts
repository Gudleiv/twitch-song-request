import { SpotifyApi } from '@spotify/web-api-ts-sdk';
import type { BasePlayer, TrackInfo, PlayerResult } from '../base.player.js';
import { getValidAccessToken } from './spotify.auth.js';
import { getToken } from '../../storage/token.store.js';

// Паттерн для распознавания Spotify-ссылок и URI
const SPOTIFY_TRACK_URL = /spotify\.com\/track\/([A-Za-z0-9]+)/;
const SPOTIFY_TRACK_URI = /^spotify:track:([A-Za-z0-9]+)$/;

function extractTrackId(query: string): string | null {
  const urlMatch = query.match(SPOTIFY_TRACK_URL);
  if (urlMatch) return urlMatch[1];

  const uriMatch = query.match(SPOTIFY_TRACK_URI);
  if (uriMatch) return uriMatch[1];

  return null;
}

async function buildSdk(): Promise<SpotifyApi> {
  const accessToken = await getValidAccessToken();
  if (!accessToken) throw new Error('Spotify not authorized');

  const stored = getToken('spotify');

  return SpotifyApi.withAccessToken(process.env.SPOTIFY_CLIENT_ID!, {
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: stored?.expiresAt
      ? Math.floor((stored.expiresAt - Date.now()) / 1000)
      : 3600,
    refresh_token: stored?.refreshToken ?? '',
  });
}

export class SpotifyPlayer implements BasePlayer {
  isAuthorized(): boolean {
    return getToken('spotify') !== undefined;
  }

  async resolve(query: string): Promise<TrackInfo | null> {
    const sdk = await buildSdk();
    const trackId = extractTrackId(query);

    if (trackId) {
      const track = await sdk.tracks.get(trackId);
      return {
        id: track.id,
        title: track.name,
        artist: track.artists.map(a => a.name).join(', '),
        durationMs: track.duration_ms,
        explicit: track.explicit,
        uri: track.uri,
      };
    }

    // Поиск по ключевым словам
    const results = await sdk.search(query, ['track'], undefined, 1);
    const track = results.tracks.items[0];
    if (!track) return null;

    return {
      id: track.id,
      title: track.name,
      artist: track.artists.map(a => a.name).join(', '),
      durationMs: track.duration_ms,
      explicit: track.explicit,
      uri: track.uri,
    };
  }

  async enqueue(track: TrackInfo): Promise<PlayerResult> {
    const accessToken = await getValidAccessToken();
    if (!accessToken) {
      return { success: false, error: 'Spotify not authorized' };
    }

    const res = await fetch(
      `https://api.spotify.com/v1/me/player/queue?uri=${encodeURIComponent(track.uri)}`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!res.ok) {
      const body = await res.text();

      // Если нет активного устройства — попробуем активировать первое доступное
      if (res.status === 404 && body.includes('NO_ACTIVE_DEVICE')) {
        const activated = await this.activateFirstDevice(accessToken);
        if (!activated) {
          return { success: false, error: 'Нет активных устройств Spotify. Открой Spotify на любом устройстве.' };
        }

        // Повторная попытка после активации устройства
        const retry = await fetch(
          `https://api.spotify.com/v1/me/player/queue?uri=${encodeURIComponent(track.uri)}`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );

        if (!retry.ok) {
          const retryBody = await retry.text();
          return { success: false, error: `Spotify API error: ${retry.status} ${retryBody}` };
        }

        return { success: true, track };
      }

      return { success: false, error: `Spotify API error: ${res.status} ${body}` };
    }

    return { success: true, track };
  }

  private async activateFirstDevice(accessToken: string): Promise<boolean> {
    const res = await fetch('https://api.spotify.com/v1/me/player/devices', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) return false;

    const data = await res.json() as { devices: { id: string; is_active: boolean }[] };
    const device = data.devices[0];
    if (!device) return false;

    const transfer = await fetch('https://api.spotify.com/v1/me/player', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ device_ids: [device.id], play: false }),
    });

    return transfer.ok || transfer.status === 204;
  }
}
