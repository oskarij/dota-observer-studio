import { contextBridge, ipcRenderer } from 'electron';

import type { OverlayConfig } from '../shared/componentSettings.js';

// CommonJS (.cts) and self-contained so Electron's sandboxed preload can load it:
// a sandboxed preload cannot use ESM or require local modules. Channel names are
// inlined for that reason — keep in sync with src/shared/ipcChannels.ts.
const SETTINGS_GET_CHANNEL = 'settings:get';
const SETTINGS_SET_CHANNEL = 'settings:set';

const api = {
  platform: 'desktop',
  settings: {
    get: (): Promise<OverlayConfig> => ipcRenderer.invoke(SETTINGS_GET_CHANNEL),
    set: (config: OverlayConfig): Promise<void> => ipcRenderer.invoke(SETTINGS_SET_CHANNEL, config)
  }
} as const;

contextBridge.exposeInMainWorld('dotaSpectatorTools', api);
