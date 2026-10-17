import { ipcMain } from 'electron';

import type { PlayerRankStore } from '../../persistence/playerRankStore.js';
import type { PlayerRankService } from '../../runtime/playerRankService.js';
import { PLAYER_RANKS_CLEAR_CHANNEL } from '../../shared/ipcChannels.js';
import { logError } from '../../shared/logger.js';

// Clear both cache layers so the next selected-player update can fetch a fresh rank.
export function registerPlayerRanksIpc(
  store: PlayerRankStore,
  service: PlayerRankService
): () => void {
  ipcMain.handle(PLAYER_RANKS_CLEAR_CHANNEL, () => {
    try {
      store.deleteAll();
      service.clearSessionCache();
    } catch (error) {
      logError('Failed to clear the player rank cache', error);
      throw new Error('Could not clear the rank cache.');
    }
  });

  return () => {
    ipcMain.removeHandler(PLAYER_RANKS_CLEAR_CHANNEL);
  };
}
