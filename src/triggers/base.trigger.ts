export interface SongRequestEvent {
  query: string;
  requestedBy: string;
}

export interface BaseTrigger {
  start(
    onRequest: (
      event: SongRequestEvent,
      fulfill: () => Promise<void>,
      cancel: () => Promise<void>
    ) => Promise<void>
  ): Promise<void>;
  stop(): Promise<void>;
}
