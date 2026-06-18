import type { OverlayConfig } from './shared/componentSettings.js';
import type { KnownPlayer } from './shared/knownPlayer.js';

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
      };
      fonts?: {
        list(): Promise<string[]>;
      };
      knownPlayers?: {
        get(): Promise<KnownPlayer[]>;
        set(players: KnownPlayer[]): Promise<void>;
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
