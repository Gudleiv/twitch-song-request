export interface TrackInfo {
  id: string;
  title: string;
  artist: string;
  durationMs: number;
  explicit: boolean;
  uri: string;
}

export interface PlayerResult {
  success: boolean;
  track?: TrackInfo;
  error?: string;
}

export interface BasePlayer {
  /** Найти трек по ключевому слову или прямой ссылке */
  resolve(query: string): Promise<TrackInfo | null>;
  /** Добавить трек в очередь */
  enqueue(track: TrackInfo): Promise<PlayerResult>;
  /** Проверить, авторизован ли плеер */
  isAuthorized(): boolean;
}
