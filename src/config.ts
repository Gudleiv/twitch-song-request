function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env variable: ${name}`);
  return value;
}

export const config = {
  port: parseInt(process.env.PORT ?? '3000', 10),
  baseUrl: requireEnv('BASE_URL'),

  twitch: {
    clientId: requireEnv('TWITCH_CLIENT_ID'),
    clientSecret: requireEnv('TWITCH_CLIENT_SECRET'),
    userId: requireEnv('TWITCH_USER_ID'),
  },

  spotify: {
    clientId: requireEnv('SPOTIFY_CLIENT_ID'),
    clientSecret: requireEnv('SPOTIFY_CLIENT_SECRET'),
    redirectUri: () => `${config.baseUrl}/auth/spotify/callback`,
  },

  adminPassword: requireEnv('ADMIN_PASSWORD'),

  dataDir: process.env.DATA_DIR ?? './data',
} as const;
