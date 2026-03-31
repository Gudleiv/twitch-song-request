export interface SongRequestEvent {
  query: string;
  requestedBy: string;
}

export interface BaseTrigger {
  /** Запустить прослушивание событий */
  start(onRequest: (event: SongRequestEvent) => Promise<void>): Promise<void>;
  /** Остановить */
  stop(): Promise<void>;
}
