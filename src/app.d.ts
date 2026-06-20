import type { OverlayConfig } from './shared/componentSettings.js';
import type { SeriesGame, WatchedGame } from './shared/fearlessDraft.js';
import type { KnownPlayer } from './shared/knownPlayer.js';
import type { NetworkInfo, NetworkSettings } from './shared/networkConfig.js';

declare global {
  namespace App {
    interface Locals {}
    interface PageData {}
    interface PageState {}
    interface Platform {}
  }

  // Exposed by the Electron preload bridge; absent when the UI runs in a plain browser.
  interface Window {
    dotaSpectatorTools?: {
      platform: string;
      settings?: {
        get(): Promise<OverlayConfig>;
        set(config: OverlayConfig): Promise<void>;
        export(): Promise<{ ok: boolean; path?: string; reason?: string }>;
        import(): Promise<{ ok: boolean; config?: OverlayConfig; reason?: string }>;
      };
      network?: {
        get(): Promise<NetworkInfo>;
        set(settings: NetworkSettings): Promise<{ ok: boolean; reason?: string }>;
      };
      gsi?: {
        install(): Promise<{ ok: boolean; path?: string; reason?: string }>;
        export(): Promise<{ ok: boolean; path?: string; reason?: string }>;
      };
      playerRanks?: {
        clear(): Promise<void>;
      };
      fonts?: {
        list(): Promise<string[]>;
      };
      knownPlayers?: {
        get(): Promise<KnownPlayer[]>;
        set(players: KnownPlayer[]): Promise<void>;
        exportCsv(csv: string): Promise<{ ok: boolean; path?: string; reason?: string }>;
        importCsv(): Promise<{ ok: boolean; text?: string; reason?: string }>;
      };
      fearless?: {
        getWatchedGames(): Promise<WatchedGame[]>;
        onWatchedGamesChanged(handler: () => void): () => void;
        getSeries(): Promise<SeriesGame[]>;
        setSeries(series: SeriesGame[]): Promise<void>;
        fetchMatch(matchId: string): Promise<{ ok: boolean; game?: WatchedGame; reason?: string }>;
      };
      app?: {
        setDirty(dirty: boolean): void;
        onSaveAndQuit(handler: () => void): () => void;
        confirmQuit(): void;
      };
    };
  }
}

export {};
