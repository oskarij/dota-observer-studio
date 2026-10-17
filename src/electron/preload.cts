import { contextBridge, ipcRenderer } from 'electron';
import type { StudioApi } from '../shared/studioApi.js';

function subscribe(channel: string, handler: () => void): () => void {
  const listener = (): void => handler();
  ipcRenderer.on(channel, listener);
  return () => {
    ipcRenderer.removeListener(channel, listener);
  };
}

// Sandboxed preloads cannot require local modules; channel strings must stay inline.
const api: StudioApi = {
  platform: 'desktop',
  settings: {
    get: (...args) => ipcRenderer.invoke('settings:get', ...args),
    set: (...args) => ipcRenderer.invoke('settings:set', ...args),
    export: (...args) => ipcRenderer.invoke('settings:export', ...args),
    import: (...args) => ipcRenderer.invoke('settings:import', ...args),
    openMediaFolder: () => ipcRenderer.invoke('settings:open-media-folder')
  },
  network: {
    get: (...args) => ipcRenderer.invoke('network:get', ...args),
    set: (...args) => ipcRenderer.invoke('network:set', ...args)
  },
  gsi: {
    install: (...args) => ipcRenderer.invoke('gsi:install', ...args),
    export: (...args) => ipcRenderer.invoke('gsi:export', ...args)
  },
  playerRanks: {
    clear: (...args) => ipcRenderer.invoke('player-ranks:clear', ...args)
  },
  fonts: {
    list: (...args) => ipcRenderer.invoke('fonts:list', ...args)
  },
  knownPlayers: {
    get: (...args) => ipcRenderer.invoke('known-players:get', ...args),
    set: (...args) => ipcRenderer.invoke('known-players:set', ...args),
    add: (...args) => ipcRenderer.invoke('known-players:add', ...args),
    update: (...args) => ipcRenderer.invoke('known-players:update', ...args),
    remove: (...args) => ipcRenderer.invoke('known-players:remove', ...args),
    exportCsv: (...args) => ipcRenderer.invoke('known-players:export-csv', ...args),
    importCsv: (...args) => ipcRenderer.invoke('known-players:import-csv', ...args),
    onChanged: (handler) => subscribe('known-players:changed', handler)
  },
  teams: {
    get: (...args) => ipcRenderer.invoke('teams:get', ...args),
    add: (...args) => ipcRenderer.invoke('teams:add', ...args),
    update: (...args) => ipcRenderer.invoke('teams:update', ...args),
    remove: (...args) => ipcRenderer.invoke('teams:remove', ...args),
    pickLogo: (...args) => ipcRenderer.invoke('teams:pick-logo', ...args),
    onChanged: (handler) => subscribe('teams:changed', handler)
  },
  series: {
    get: (...args) => ipcRenderer.invoke('series:get', ...args),
    setTeam: (...args) => ipcRenderer.invoke('series:set-team', ...args),
    swapSides: () => ipcRenderer.invoke('series:swap-sides'),
    adjustScore: (...args) => ipcRenderer.invoke('series:adjust-score', ...args),
    useAutomaticScore: (...args) => ipcRenderer.invoke('series:use-automatic-score', ...args),
    resetScores: () => ipcRenderer.invoke('series:reset-scores'),
    onChanged: (handler) => subscribe('series:changed', handler)
  },
  tournament: {
    get: (...args) => ipcRenderer.invoke('tournament:get', ...args),
    refresh: (...args) => ipcRenderer.invoke('tournament:refresh', ...args),
    setApiKey: (...args) => ipcRenderer.invoke('tournament:set-api-key', ...args),
    onChanged: (handler) => subscribe('tournament:changed', handler)
  },
  fearless: {
    getWatchedGames: (...args) => ipcRenderer.invoke('watched-games:get', ...args),
    onWatchedGamesChanged: (handler) => subscribe('watched-games:changed', handler),
    getSeries: (...args) => ipcRenderer.invoke('fearless-series:get', ...args),
    editSeries: (...args) => ipcRenderer.invoke('fearless-series:set', ...args),
    onSeriesChanged: (handler) => subscribe('fearless-series:changed', handler),
    fetchMatch: (...args) => ipcRenderer.invoke('fearless:fetch-match', ...args)
  },
  app: {
    setDirty: (...args) => ipcRenderer.send('app:dirty-changed', ...args),
    onSaveAndQuit: (handler) => subscribe('app:save-and-quit', handler),
    confirmQuit: (...args) => ipcRenderer.send('app:quit-confirmed', ...args)
  }
};

contextBridge.exposeInMainWorld('dotaSpectatorTools', api);
