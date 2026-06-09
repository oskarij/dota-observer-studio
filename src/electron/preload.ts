import { contextBridge } from 'electron';

const api = {
  platform: 'desktop'
} as const;

contextBridge.exposeInMainWorld('dotaSpectatorTools', api);
