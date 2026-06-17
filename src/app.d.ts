import type { OverlayConfig } from './shared/componentSettings.js';

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
    };
  }
}

export {};
