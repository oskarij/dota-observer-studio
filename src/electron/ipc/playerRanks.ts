import { ipcMain } from 'electron';

import type { PlayerRankStore } from '../../persistence/playerRankStore.js';
import { PLAYER_RANKS_CLEAR_CHANNEL } from '../../shared/ipcChannels.js';
import { logError } from '../../shared/logger.js';

// Clears the persisted rank cache. The playerRankService's in-session guard maps aren't reset, so a
// player already seen this run refetches on the next new game rather than immediately, which is
// acceptable for a "clear cache" action and avoids reaching into the running service.
export function registerPlayerRanksIpc(store: PlayerRankStore): () => void {
  ipcMain.handle(PLAYER_RANKS_CLEAR_CHANNEL, () => {
    try {
      store.deleteAll();
    } catch (error) {
      // A locked/busy DB can throw here; surface a clean message to the renderer instead of a raw
      // rejection.
      logError('Failed to clear the player rank cache', error);
      throw new Error('Could not clear the rank cache.');
    }
  });

  return () => {
    ipcMain.removeHandler(PLAYER_RANKS_CLEAR_CHANNEL);
  };
}
