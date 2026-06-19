import type { OverlayConfig } from './shared/componentSettings.js';
import type { KnownPlayer } from './shared/knownPlayer.js';
import type { ConfigurablePorts, NetworkInfo } from './shared/networkConfig.js';

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
        set(ports: ConfigurablePorts): Promise<{ ok: boolean; reason?: string }>;
      };
      gsi?: {
        install(): Promise<{ ok: boolean; path?: string; reason?: string }>;
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
      app?: {
        setDirty(dirty: boolean): void;
        onSaveAndQuit(handler: () => void): () => void;
        confirmQuit(): void;
      };
    };
  }
}

export {};
