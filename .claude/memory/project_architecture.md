---
name: Project Architecture
description: Архитектура и стек gudis-twitch-song-request — Twitch Channel Points → Spotify queue
type: project
---

Single-user приложение: Twitch Channel Points → Spotify queue.

**Why:** Spotify Dev Mode ограничивает до 25 пользователей ручным allowlist — мультипользовательская архитектура не нужна.

**How to apply:** Не усложнять архитектуру под мультитенант. Хранилище — SQLite через node:sqlite (встроен в Node 22+, без нативной компиляции).

## Стек
- Runtime: Node.js 22 (ESM, `"type": "module"`)
- Language: TypeScript 5, tsconfig module=NodeNext
- HTTP: Fastify 5 + @fastify/view (Eta шаблонизатор) + @fastify/formbody + @fastify/static
- Twitch: @twurple/auth + @twurple/api + @twurple/eventsub-ws (WebSocket, не HTTP webhook)
- Spotify: @spotify/web-api-ts-sdk (официальный)
- Storage: node:sqlite (встроенный, не better-sqlite3 — нет VS Build Tools на машине)
- Dev: tsx watch
- Deploy: Docker Compose, platform linux/amd64

## Структура
```
src/
  index.ts                    # entry point
  config.ts                   # requireEnv()
  storage/token.store.ts      # SQLite: tokens + settings
  player/base.player.ts       # интерфейс BasePlayer
  player/spotify/             # SpotifyPlayer + oauth
  queue/queue.service.ts      # фильтры (explicit, maxDuration)
  triggers/base.trigger.ts    # интерфейс BaseTrigger
  triggers/twitch/            # TwitchTrigger + auth (RefreshingAuthProvider + ApiClient)
  web/server.ts               # Fastify bootstrap
  web/routes/auth.routes.ts   # /auth/twitch, /auth/spotify + callbacks
  web/routes/settings.routes.ts # /setup, /settings
  web/templates/              # Eta шаблоны (layout, setup, settings, callback)
  web/static/style.css
```

## Ключевые детали
- Twitch auth: `RefreshingAuthProvider` + `ApiClient` из @twurple/api; `onRefresh` — метод события, не поле конфига
- EventSub WS: `EventSubWsListener({ apiClient })` — принимает ApiClient, не authProvider напрямую
- Spotify: ручной OAuth flow (не SDK-flow), токены хранятся в SQLite с авто-рефрешем
- OBS widget: не реализован (отложен)
- Triggers расширяемы: интерфейс BaseTrigger готов для будущих донат-платформ