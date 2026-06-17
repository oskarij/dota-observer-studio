import { contextBridge, ipcRenderer } from 'electron';

import type { OverlayConfig } from '../shared/componentSettings.js';

// CommonJS (.cts) and self-contained so Electron's sandboxed preload can load it:
// a sandboxed preload cannot use ESM or require local modules. Channel names are
// inlined for that reason — keep in sync with src/shared/ipcChannels.ts.
const SETTINGS_GET_CHANNEL = 'settings:get';
const SETTINGS_SET_CHANNEL = 'settings:set';
const FONTS_LIST_CHANNEL = 'fonts:list';
const APP_DIRTY_CHANGED_CHANNEL = 'app:dirty-changed';
const APP_SAVE_AND_QUIT_CHANNEL = 'app:save-and-quit';
const APP_QUIT_CONFIRMED_CHANNEL = 'app:quit-confirmed';

const api = {
  platform: 'desktop',
  settings: {
    get: (): Promise<OverlayConfig> => ipcRenderer.invoke(SETTINGS_GET_CHANNEL),
    set: (config: OverlayConfig): Promise<void> => ipcRenderer.invoke(SETTINGS_SET_CHANNEL, config)
  },
  fonts: {
    list: (): Promise<string[]> => ipcRenderer.invoke(FONTS_LIST_CHANNEL)
  },
  app: {
    // Keep main informed of unsaved changes so it can guard the window close.
    setDirty: (dirty: boolean): void => ipcRenderer.send(APP_DIRTY_CHANGED_CHANNEL, dirty),
    // Main asks the renderer to persist before quitting; returns an unsubscribe.
    onSaveAndQuit: (handler: () => void): (() => void) => {
      const listener = (): void => handler();
      ipcRenderer.on(APP_SAVE_AND_QUIT_CHANNEL, listener);
      return () => ipcRenderer.removeListener(APP_SAVE_AND_QUIT_CHANNEL, listener);
    },
    confirmQuit: (): void => ipcRenderer.send(APP_QUIT_CONFIRMED_CHANNEL)
  }
} as const;

contextBridge.exposeInMainWorld('dotaSpectatorTools', api);
