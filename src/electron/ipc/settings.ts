import { ipcMain, type OpenDialogOptions, type SaveDialogOptions } from 'electron';
import { readFile, writeFile } from 'node:fs/promises';

import type { OverlayGsiEventStream } from '../../runtime/overlayGsiEventStream.js';
import type { OverlayConfig } from '../../shared/componentSettings.js';
import {
  SETTINGS_EXPORT_CHANNEL,
  SETTINGS_GET_CHANNEL,
  SETTINGS_IMPORT_CHANNEL,
  SETTINGS_SET_CHANNEL
} from '../../shared/ipcChannels.js';
import { logError } from '../../shared/logger.js';
import { createSettingsStore } from '../settingsStore.js';

import { showOpenDialog, showSaveDialog } from './dialogs.js';

export interface SettingsExportResult {
  ok: boolean;
  path?: string;
  reason?: string;
}

export interface SettingsImportResult {
  ok: boolean;
  // The merged config on success, so the renderer can refresh its working copy.
  config?: OverlayConfig;
  reason?: string;
}

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

  ipcMain.handle(SETTINGS_EXPORT_CHANNEL, async (): Promise<SettingsExportResult> => {
    try {
      const saveOptions: SaveDialogOptions = {
        title: 'Export overlay config',
        defaultPath: 'observer-studio-config.json',
        filters: [{ name: 'JSON', extensions: ['json'] }]
      };
      const result = await showSaveDialog(saveOptions);

      if (result.canceled || result.filePath === undefined) {
        return { ok: false, reason: 'Export canceled.' };
      }

      await writeFile(result.filePath, JSON.stringify(store.get(), null, 2), 'utf8');
      return { ok: true, path: result.filePath };
    } catch (error) {
      logError('Failed to export overlay config', error);
      return { ok: false, reason: 'Could not write the config file.' };
    }
  });

  ipcMain.handle(SETTINGS_IMPORT_CHANNEL, async (): Promise<SettingsImportResult> => {
    try {
      const openOptions: OpenDialogOptions = {
        title: 'Import overlay config',
        properties: ['openFile'],
        filters: [{ name: 'JSON', extensions: ['json'] }]
      };
      const result = await showOpenDialog(openOptions);

      const filePath = result.canceled ? undefined : result.filePaths[0];
      if (filePath === undefined) {
        return { ok: false, reason: 'Import canceled.' };
      }

      const parsed: unknown = JSON.parse(await readFile(filePath, 'utf8'));
      if (!isOverlayConfigShape(parsed)) {
        return { ok: false, reason: 'That file is not a valid Observer Studio config.' };
      }

      store.set(parsed);
      // store.get() re-applies the field-level merge over defaults, so a partial/older file is
      // filled in before it reaches the overlay and the renderer.
      const merged = store.get();
      eventStream.setSettings(merged);
      return { ok: true, config: merged };
    } catch (error) {
      logError('Failed to import overlay config', error);
      return { ok: false, reason: 'Could not read or parse the config file.' };
    }
  });

  return () => {
    ipcMain.removeHandler(SETTINGS_GET_CHANNEL);
    ipcMain.removeHandler(SETTINGS_SET_CHANNEL);
    ipcMain.removeHandler(SETTINGS_EXPORT_CHANNEL);
    ipcMain.removeHandler(SETTINGS_IMPORT_CHANNEL);
  };
}

// Minimal structural check; settingsStore.get() handles the field-level merge over defaults.
function isOverlayConfigShape(value: unknown): value is OverlayConfig {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    isPlainObject(candidate.enabled) &&
    isPlainObject(candidate.settings) &&
    isPlainObject(candidate.options)
  );
}

function isPlainObject(value: unknown): boolean {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
