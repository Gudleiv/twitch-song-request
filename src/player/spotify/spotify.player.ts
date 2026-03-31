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
      return { success: false, error: `Spotify API error: ${res.status} ${body}` };
    }

    return { success: true, track };
  }
}
