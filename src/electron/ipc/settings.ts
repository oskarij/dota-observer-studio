import { ipcMain } from 'electron';

import type { OverlayGsiEventStream } from '../../runtime/overlayGsiEventStream.js';
import type { OverlayConfig } from '../../shared/componentSettings.js';
import { SETTINGS_GET_CHANNEL, SETTINGS_SET_CHANNEL } from '../../shared/ipcChannels.js';
import { createSettingsStore } from '../settingsStore.js';

// The main process is the single source of truth: it persists settings and pushes them to
// live-overlay clients. The renderer drives its own preview reactively, so this is the
// persistence + cross-process fan-out path only.
export function registerSettingsIpc(eventStream: OverlayGsiEventStream): () => void {
  const store = createSettingsStore();

  // Seed the stream so an overlay opened before the studio still renders the saved layout.
  eventStream.setSettings(store.get());

  ipcMain.handle(SETTINGS_GET_CHANNEL, () => store.get());
  ipcMain.handle(SETTINGS_SET_CHANNEL, (_event, config: OverlayConfig) => {
    store.set(config);
    eventStream.setSettings(config);
  });

  return () => {
    ipcMain.removeHandler(SETTINGS_GET_CHANNEL);
    ipcMain.removeHandler(SETTINGS_SET_CHANNEL);
  };
}
