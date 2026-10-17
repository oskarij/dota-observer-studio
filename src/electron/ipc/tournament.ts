import type { Result } from '../../shared/result.js';
import { ipcMain } from 'electron';

import type { TournamentService } from '../../runtime/tournamentService.js';
import {
  TOURNAMENT_GET_CHANNEL,
  TOURNAMENT_REFRESH_CHANNEL,
  TOURNAMENT_SET_API_KEY_CHANNEL
} from '../../shared/ipcChannels.js';
import type { TournamentView } from '../../shared/studioApi.js';
import type { TournamentStore } from '../tournamentStore.js';

export type TournamentCommandResult = Result;

const STEAM_API_KEY = /^[0-9A-F]{32}$/i;

export function registerTournamentIpc(
  service: TournamentService,
  store: Pick<TournamentStore, 'getApiKey' | 'setApiKey'>
): () => void {
  ipcMain.handle(
    TOURNAMENT_GET_CHANNEL,
    (): TournamentView => ({ ...service.getState(), hasApiKey: store.getApiKey() !== null })
  );

  ipcMain.handle(TOURNAMENT_REFRESH_CHANNEL, () => service.refresh());

  ipcMain.handle(
    TOURNAMENT_SET_API_KEY_CHANNEL,
    async (_event, key: unknown): Promise<TournamentCommandResult> => {
      const trimmed = typeof key === 'string' ? key.trim() : key;
      if (trimmed !== null && (typeof trimmed !== 'string' || !STEAM_API_KEY.test(trimmed))) {
        return { ok: false, reason: 'A Steam Web API key is 32 letters and digits.' };
      }
      store.setApiKey(trimmed);
      await service.refresh();
      return { ok: true };
    }
  );

  return () => {
    ipcMain.removeHandler(TOURNAMENT_GET_CHANNEL);
    ipcMain.removeHandler(TOURNAMENT_REFRESH_CHANNEL);
    ipcMain.removeHandler(TOURNAMENT_SET_API_KEY_CHANNEL);
  };
}
