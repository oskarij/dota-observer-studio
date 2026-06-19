import { ipcMain, type OpenDialogOptions, type SaveDialogOptions } from 'electron';
import { readFile, writeFile } from 'node:fs/promises';

import type { KnownPlayersStore } from '../../persistence/knownPlayersStore.js';
import type { OverlayGsiEventStream } from '../../runtime/overlayGsiEventStream.js';
import type { KnownPlayer } from '../../shared/knownPlayer.js';
import {
  KNOWN_PLAYERS_EXPORT_CSV_CHANNEL,
  KNOWN_PLAYERS_GET_CHANNEL,
  KNOWN_PLAYERS_IMPORT_CSV_CHANNEL,
  KNOWN_PLAYERS_SET_CHANNEL
} from '../../shared/ipcChannels.js';
import { logError } from '../../shared/logger.js';

import { showOpenDialog, showSaveDialog } from './dialogs.js';

export interface KnownPlayersExportResult {
  ok: boolean;
  path?: string;
  reason?: string;
}

export interface KnownPlayersImportResult {
  ok: boolean;
  // The raw file text on success; the renderer parses/validates it with the shared CSV util.
  text?: string;
  reason?: string;
}

// Persists the known-players list and fans it out to live-overlay clients. Like the settings IPC,
// the main process is the single source of truth; the renderer's preview reads the same list over
// the get channel and drives itself reactively, so this is the persistence + SSE broadcast path.
// CSV import/export only does the file dialog + raw I/O here; serialize/parse lives in the renderer
// so it can reuse the editor's validation rules.
export function registerKnownPlayersIpc(
  store: KnownPlayersStore,
  eventStream: OverlayGsiEventStream
): () => void {
  // Seed the stream so an overlay opened before the studio still gets the saved list.
  eventStream.setKnownPlayers(store.list());

  ipcMain.handle(KNOWN_PLAYERS_GET_CHANNEL, () => store.list());
  ipcMain.handle(KNOWN_PLAYERS_SET_CHANNEL, (_event, players: KnownPlayer[]) => {
    store.replaceAll(players);
    eventStream.setKnownPlayers(players);
  });

  ipcMain.handle(
    KNOWN_PLAYERS_EXPORT_CSV_CHANNEL,
    async (_event, csv: string): Promise<KnownPlayersExportResult> => {
      try {
        const saveOptions: SaveDialogOptions = {
          title: 'Export known players',
          defaultPath: 'known-players.csv',
          filters: [{ name: 'CSV', extensions: ['csv'] }]
        };
        const result = await showSaveDialog(saveOptions);

        if (result.canceled || result.filePath === undefined) {
          return { ok: false, reason: 'Export canceled.' };
        }

        await writeFile(result.filePath, csv, 'utf8');
        return { ok: true, path: result.filePath };
      } catch (error) {
        logError('Failed to export known players', error);
        return { ok: false, reason: 'Could not write the CSV file.' };
      }
    }
  );

  ipcMain.handle(KNOWN_PLAYERS_IMPORT_CSV_CHANNEL, async (): Promise<KnownPlayersImportResult> => {
    try {
      const openOptions: OpenDialogOptions = {
        title: 'Import known players',
        properties: ['openFile'],
        filters: [{ name: 'CSV', extensions: ['csv'] }]
      };
      const result = await showOpenDialog(openOptions);

      const filePath = result.canceled ? undefined : result.filePaths[0];
      if (filePath === undefined) {
        return { ok: false, reason: 'Import canceled.' };
      }

      const text = await readFile(filePath, 'utf8');
      return { ok: true, text };
    } catch (error) {
      logError('Failed to read known-players CSV', error);
      return { ok: false, reason: 'Could not read the CSV file.' };
    }
  });

  return () => {
    ipcMain.removeHandler(KNOWN_PLAYERS_GET_CHANNEL);
    ipcMain.removeHandler(KNOWN_PLAYERS_SET_CHANNEL);
    ipcMain.removeHandler(KNOWN_PLAYERS_EXPORT_CSV_CHANNEL);
    ipcMain.removeHandler(KNOWN_PLAYERS_IMPORT_CSV_CHANNEL);
  };
}
