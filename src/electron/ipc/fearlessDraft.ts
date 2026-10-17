import { ipcMain } from 'electron';
import type { FearlessService } from '../../runtime/fearlessService.js';
import {
  FEARLESS_FETCH_MATCH_CHANNEL,
  FEARLESS_SERIES_GET_CHANNEL,
  FEARLESS_SERIES_SET_CHANNEL,
  WATCHED_GAMES_GET_CHANNEL
} from '../../shared/ipcChannels.js';

export function registerFearlessDraftIpc(service: FearlessService): () => void {
  ipcMain.handle(WATCHED_GAMES_GET_CHANNEL, () => service.getWatched());
  ipcMain.handle(FEARLESS_SERIES_GET_CHANNEL, () => service.getSeries());
  ipcMain.handle(FEARLESS_SERIES_SET_CHANNEL, (_event, command: unknown, revision: unknown) =>
    service.edit(command, revision)
  );
  ipcMain.handle(FEARLESS_FETCH_MATCH_CHANNEL, (_event, matchId: unknown) =>
    service.fetchMatch(matchId)
  );
  return () => {
    for (const channel of [
      WATCHED_GAMES_GET_CHANNEL,
      FEARLESS_SERIES_GET_CHANNEL,
      FEARLESS_SERIES_SET_CHANNEL,
      FEARLESS_FETCH_MATCH_CHANNEL
    ])
      ipcMain.removeHandler(channel);
  };
}
