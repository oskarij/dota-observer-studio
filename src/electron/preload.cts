import { contextBridge, ipcRenderer } from 'electron';

import type { OverlayConfig } from '../shared/componentSettings.js';
import type { KnownPlayer } from '../shared/knownPlayer.js';
import type { NetworkInfo, NetworkSettings } from '../shared/networkConfig.js';

// CommonJS (.cts) and self-contained so Electron's sandboxed preload can load it:
// a sandboxed preload cannot use ESM or require local modules. Channel names are
// inlined for that reason. Keep in sync with src/shared/ipcChannels.ts.
const SETTINGS_GET_CHANNEL = 'settings:get';
const SETTINGS_SET_CHANNEL = 'settings:set';
const SETTINGS_EXPORT_CHANNEL = 'settings:export';
const SETTINGS_IMPORT_CHANNEL = 'settings:import';
const NETWORK_GET_CHANNEL = 'network:get';
const NETWORK_SET_CHANNEL = 'network:set';
const GSI_INSTALL_CHANNEL = 'gsi:install';
const GSI_EXPORT_CHANNEL = 'gsi:export';
const PLAYER_RANKS_CLEAR_CHANNEL = 'player-ranks:clear';
const FONTS_LIST_CHANNEL = 'fonts:list';
const KNOWN_PLAYERS_GET_CHANNEL = 'known-players:get';
const KNOWN_PLAYERS_SET_CHANNEL = 'known-players:set';
const KNOWN_PLAYERS_EXPORT_CSV_CHANNEL = 'known-players:export-csv';
const KNOWN_PLAYERS_IMPORT_CSV_CHANNEL = 'known-players:import-csv';
const APP_DIRTY_CHANGED_CHANNEL = 'app:dirty-changed';
const APP_SAVE_AND_QUIT_CHANNEL = 'app:save-and-quit';
const APP_QUIT_CONFIRMED_CHANNEL = 'app:quit-confirmed';

// These mirror the result types declared in the corresponding main-process IPC modules; kept
// inline because the sandboxed preload cannot import them.
interface OkResult {
  ok: boolean;
  reason?: string;
}

const api = {
  platform: 'desktop',
  settings: {
    get: (): Promise<OverlayConfig> => ipcRenderer.invoke(SETTINGS_GET_CHANNEL),
    set: (config: OverlayConfig): Promise<void> => ipcRenderer.invoke(SETTINGS_SET_CHANNEL, config),
    export: (): Promise<OkResult & { path?: string }> =>
      ipcRenderer.invoke(SETTINGS_EXPORT_CHANNEL),
    import: (): Promise<OkResult & { config?: OverlayConfig }> =>
      ipcRenderer.invoke(SETTINGS_IMPORT_CHANNEL)
  },
  network: {
    get: (): Promise<NetworkInfo> => ipcRenderer.invoke(NETWORK_GET_CHANNEL),
    set: (settings: NetworkSettings): Promise<OkResult> =>
      ipcRenderer.invoke(NETWORK_SET_CHANNEL, settings)
  },
  gsi: {
    install: (): Promise<OkResult & { path?: string }> => ipcRenderer.invoke(GSI_INSTALL_CHANNEL),
    export: (): Promise<OkResult & { path?: string }> => ipcRenderer.invoke(GSI_EXPORT_CHANNEL)
  },
  playerRanks: {
    clear: (): Promise<void> => ipcRenderer.invoke(PLAYER_RANKS_CLEAR_CHANNEL)
  },
  fonts: {
    list: (): Promise<string[]> => ipcRenderer.invoke(FONTS_LIST_CHANNEL)
  },
  knownPlayers: {
    get: (): Promise<KnownPlayer[]> => ipcRenderer.invoke(KNOWN_PLAYERS_GET_CHANNEL),
    set: (players: KnownPlayer[]): Promise<void> =>
      ipcRenderer.invoke(KNOWN_PLAYERS_SET_CHANNEL, players),
    exportCsv: (csv: string): Promise<OkResult & { path?: string }> =>
      ipcRenderer.invoke(KNOWN_PLAYERS_EXPORT_CSV_CHANNEL, csv),
    importCsv: (): Promise<OkResult & { text?: string }> =>
      ipcRenderer.invoke(KNOWN_PLAYERS_IMPORT_CSV_CHANNEL)
  },
  app: {
    // Keep main informed of unsaved changes so it can guard the window close.
    setDirty: (dirty: boolean): void => ipcRenderer.send(APP_DIRTY_CHANGED_CHANNEL, dirty),
    // Main asks the renderer to persist before quitting.
    onSaveAndQuit: (handler: () => void): (() => void) => {
      const listener = (): void => handler();
      ipcRenderer.on(APP_SAVE_AND_QUIT_CHANNEL, listener);
      return () => ipcRenderer.removeListener(APP_SAVE_AND_QUIT_CHANNEL, listener);
    },
    confirmQuit: (): void => ipcRenderer.send(APP_QUIT_CONFIRMED_CHANNEL)
  }
} as const;

contextBridge.exposeInMainWorld('dotaSpectatorTools', api);
