import type { DotaGsiData } from '../shared/dotaGsiPayload.js';
import { getDotaGsiMatchId, getPickedHeroes } from '../shared/dotaGsiPayload.js';
import type { WatchedGame } from '../shared/fearlessDraft.js';

import type { GsiPayload } from './gsiListener.js';

const FULL_LINEUP = 10;

// Records each spectated game (match id + its 10 picked heroes) once it reaches GAME_IN_PROGRESS,
// where the lineup is locked. The operator later picks games from this list to build a fearless
// series. Capture is idempotent per match (the store dedupes), and a same-match guard avoids
// rewriting on every payload while one game is live.
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

      lastCapturedMatchId = matchId;
      const heroIds = picked.map((entry) => entry.heroId);
      const playerNames = picked.map((entry) => entry.playerName ?? '');
      const hasNames = playerNames.some((name) => name !== '');

      options.upsert({
        matchId,
        capturedAt: now(),
        heroIds,
        source: 'spectated',
        ...(hasNames ? { playerNames } : {})
      });
    }
  };
}
