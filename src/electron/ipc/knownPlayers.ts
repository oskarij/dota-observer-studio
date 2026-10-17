import { ipcMain, type OpenDialogOptions, type SaveDialogOptions } from 'electron';
import { readFile, writeFile } from 'node:fs/promises';

import type { RosterService } from '../../runtime/rosterService.js';
import type { Result } from '../../shared/result.js';
import type { OverlayGsiEventStream } from '../../runtime/overlayGsiEventStream.js';
import {
  KNOWN_PLAYERS_EXPORT_CSV_CHANNEL,
  KNOWN_PLAYERS_GET_CHANNEL,
  KNOWN_PLAYERS_IMPORT_CSV_CHANNEL,
  KNOWN_PLAYERS_SET_CHANNEL,
  KNOWN_PLAYERS_ADD_CHANNEL,
  KNOWN_PLAYERS_UPDATE_CHANNEL,
  KNOWN_PLAYERS_REMOVE_CHANNEL
} from '../../shared/ipcChannels.js';
import { logError } from '../../shared/logger.js';

import { showOpenDialog, showSaveDialog } from './dialogs.js';

type KnownPlayersExportResult = Result<{ path: string }>;
type KnownPlayersImportResult = Result<{ text: string }>;

export function registerKnownPlayersIpc(
  roster: RosterService,
  eventStream: Pick<OverlayGsiEventStream, 'setKnownPlayers'>
): () => void {
  eventStream.setKnownPlayers(roster.getPlayers().items);
  ipcMain.handle(KNOWN_PLAYERS_GET_CHANNEL, () => roster.getPlayers());
  ipcMain.handle(KNOWN_PLAYERS_SET_CHANNEL, (_event, players: unknown) =>
    roster.replacePlayers(players)
  );
  ipcMain.handle(KNOWN_PLAYERS_ADD_CHANNEL, (_event, player: unknown) => roster.addPlayer(player));
  ipcMain.handle(KNOWN_PLAYERS_UPDATE_CHANNEL, (_event, id: unknown, patch: unknown) =>
    roster.updatePlayer(id, patch)
  );
  ipcMain.handle(KNOWN_PLAYERS_REMOVE_CHANNEL, (_event, id: unknown) => roster.removePlayer(id));

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
    ipcMain.removeHandler(KNOWN_PLAYERS_ADD_CHANNEL);
    ipcMain.removeHandler(KNOWN_PLAYERS_UPDATE_CHANNEL);
    ipcMain.removeHandler(KNOWN_PLAYERS_REMOVE_CHANNEL);
    ipcMain.removeHandler(KNOWN_PLAYERS_EXPORT_CSV_CHANNEL);
    ipcMain.removeHandler(KNOWN_PLAYERS_IMPORT_CSV_CHANNEL);
  };
}
