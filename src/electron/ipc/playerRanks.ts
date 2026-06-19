import { ipcMain } from 'electron';

import type { PlayerRankStore } from '../../persistence/playerRankStore.js';
import { PLAYER_RANKS_CLEAR_CHANNEL } from '../../shared/ipcChannels.js';

// Clears the persisted rank cache. The playerRankService's in-session guard maps aren't reset, so a
// player already seen this run refetches on the next new game rather than immediately — acceptable
// for a "clear cache" action, and avoids reaching into the running service.
export function registerPlayerRanksIpc(store: PlayerRankStore): () => void {
  ipcMain.handle(PLAYER_RANKS_CLEAR_CHANNEL, () => {
    store.deleteAll();
  });

  return () => {
    ipcMain.removeHandler(PLAYER_RANKS_CLEAR_CHANNEL);
  };
}
