import type { DotaGsiData } from '../shared/dotaGsiPayload.js';
import { getDotaGsiMatchId, getGameAccountIds, getPickedHeroes } from '../shared/dotaGsiPayload.js';
import type { WatchedGame } from '../shared/fearlessDraft.js';

import type { GsiPayload } from './gsiListener.js';

const FULL_LINEUP = 10;

// Records each spectated game's 10 heroes once it reaches GAME_IN_PROGRESS. The store dedupes by
// match id; the same-match guard skips the write on every later payload of a live game.
export interface FearlessCapture {
  handlePayload(payload: GsiPayload): void;
}

export function createFearlessCapture(options: {
  upsert: (game: WatchedGame) => void;
  now?: () => number;
}): FearlessCapture {
  const now = options.now ?? (() => Date.now());
  let lastCapturedMatchId: string | null = null;

  return {
    handlePayload(payload) {
      const gsiData = payload as DotaGsiData;

      if (gsiData.map?.game_state !== 'DOTA_GAMERULES_STATE_GAME_IN_PROGRESS') {
        return;
      }

      const matchId = getDotaGsiMatchId(gsiData);
      if (matchId === null || matchId === lastCapturedMatchId) {
        return;
      }

      const picked = getPickedHeroes(gsiData);
      if (picked.length < FULL_LINEUP) {
        return;
      }

      const heroIds = picked.map((entry) => entry.heroId);
      const playerNames = picked.map((entry) => entry.playerName ?? '');
      const hasNames = playerNames.some((name) => name !== '');
      const accountIds = getGameAccountIds(gsiData);

      options.upsert({
        matchId,
        capturedAt: now(),
        heroIds,
        ...(hasNames ? { playerNames } : {}),
        ...(accountIds.length > 0 ? { accountIds } : {})
      });
      lastCapturedMatchId = matchId;
    }
  };
}
