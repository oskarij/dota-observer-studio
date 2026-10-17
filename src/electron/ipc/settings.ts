import { ipcMain, shell, type OpenDialogOptions, type SaveDialogOptions } from 'electron';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

import type { OverlayGsiEventStream } from '../../runtime/overlayGsiEventStream.js';
import { type OverlayConfig } from '../../shared/componentSettings.js';
import {
  SETTINGS_EXPORT_CHANNEL,
  SETTINGS_GET_CHANNEL,
  SETTINGS_IMPORT_CHANNEL,
  SETTINGS_OPEN_MEDIA_FOLDER_CHANNEL,
  SETTINGS_SET_CHANNEL
} from '../../shared/ipcChannels.js';
import { errorMessage, type Result } from '../../shared/result.js';
import { logError } from '../../shared/logger.js';
import { createSettingsStore } from '../settingsStore.js';

import { showOpenDialog, showSaveDialog } from './dialogs.js';

type SettingsExportResult = Result<{ path: string }>;
type SettingsImportResult = Result<{ config: OverlayConfig }>;

export function registerSettingsIpc(
  eventStream: OverlayGsiEventStream,
  mediaRoot: string
): () => void {
  const store = createSettingsStore();

  eventStream.setSettings(store.get());

  ipcMain.handle(SETTINGS_GET_CHANNEL, () => store.get());
  ipcMain.handle(SETTINGS_SET_CHANNEL, (_event, config: unknown): Result => {
    try {
      eventStream.setSettings(store.set(config));
      return { ok: true };
    } catch (error) {
      return { ok: false, reason: errorMessage(error) };
    }
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
      const merged = store.set(parsed);
      eventStream.setSettings(merged);
      return { ok: true, config: merged };
    } catch (error) {
      logError('Failed to import overlay config', error);
      return { ok: false, reason: 'Could not read or parse the config file.' };
    }
  });

  // Custom CSS refers to fonts and images dropped here as url(/media/<file>).
  ipcMain.handle(SETTINGS_OPEN_MEDIA_FOLDER_CHANNEL, async (): Promise<Result> => {
    await mkdir(mediaRoot, { recursive: true });
    const error = await shell.openPath(mediaRoot);
    return error === '' ? { ok: true } : { ok: false, reason: error };
  });

  return () => {
    ipcMain.removeHandler(SETTINGS_GET_CHANNEL);
    ipcMain.removeHandler(SETTINGS_SET_CHANNEL);
    ipcMain.removeHandler(SETTINGS_EXPORT_CHANNEL);
    ipcMain.removeHandler(SETTINGS_IMPORT_CHANNEL);
    ipcMain.removeHandler(SETTINGS_OPEN_MEDIA_FOLDER_CHANNEL);
  };
}
