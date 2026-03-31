import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import { config } from '../config.js';

export interface TokenRecord {
  provider: 'twitch' | 'spotify';
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number | null;
}

export interface Settings {
  filterExplicit: boolean;
  maxDurationSeconds: number | null;
}

let db: DatabaseSync;

export function initStorage(): void {
  const dbPath = path.join(config.dataDir, 'store.db');
  db = new DatabaseSync(dbPath);

  db.exec(`
    CREATE TABLE IF NOT EXISTS tokens (
      provider     TEXT PRIMARY KEY,
      accessToken  TEXT NOT NULL,
      refreshToken TEXT,
      expiresAt    INTEGER
    );

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reward (
      id          INTEGER PRIMARY KEY CHECK (id = 1),
      rewardId    TEXT NOT NULL,
      rewardTitle TEXT NOT NULL
    );
  `);
}

export function saveToken(record: TokenRecord): void {
  db.prepare(`
    INSERT INTO tokens (provider, accessToken, refreshToken, expiresAt)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(provider) DO UPDATE SET
      accessToken  = excluded.accessToken,
      refreshToken = excluded.refreshToken,
      expiresAt    = excluded.expiresAt
  `).run(record.provider, record.accessToken, record.refreshToken, record.expiresAt);
}

export function getToken(provider: TokenRecord['provider']): TokenRecord | undefined {
  const row = db.prepare('SELECT * FROM tokens WHERE provider = ?').get(provider);
  if (!row) return undefined;
  return row as unknown as TokenRecord;
}

export function getSettings(): Settings {
  const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
  const map = Object.fromEntries(rows.map(r => [r.key, r.value]));

  return {
    filterExplicit: map['filterExplicit'] === 'true',
    maxDurationSeconds: map['maxDurationSeconds'] ? parseInt(map['maxDurationSeconds'], 10) : null,
  };
}

export interface RewardRecord {
  rewardId: string;
  rewardTitle: string;
}

export function saveReward(record: RewardRecord): void {
  db.prepare(`
    INSERT INTO reward (id, rewardId, rewardTitle) VALUES (1, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      rewardId    = excluded.rewardId,
      rewardTitle = excluded.rewardTitle
  `).run(record.rewardId, record.rewardTitle);
}

export function getReward(): RewardRecord | undefined {
  const row = db.prepare('SELECT rewardId, rewardTitle FROM reward WHERE id = 1').get();
  return row as unknown as RewardRecord | undefined;
}

export function saveSettings(settings: Partial<Settings>): void {
  const upsert = db.prepare(`
    INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `);

  if (settings.filterExplicit !== undefined) {
    upsert.run('filterExplicit', String(settings.filterExplicit));
  }
  if (settings.maxDurationSeconds !== undefined) {
    upsert.run('maxDurationSeconds', String(settings.maxDurationSeconds ?? ''));
  }
}
