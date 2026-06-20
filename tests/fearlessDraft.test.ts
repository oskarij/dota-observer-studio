import assert from 'node:assert/strict';
import test from 'node:test';

import type { DotaGsiData } from '../src/shared/dotaGsiPayload.js';
import {
  getDotaGsiMatchId,
  getPickedHeroes,
  getPickedHeroIds
} from '../src/shared/dotaGsiPayload.js';
import { bannedHeroIdsFromSeries, type SeriesGame } from '../src/shared/fearlessDraft.js';
import { createFearlessCapture } from '../src/runtime/fearlessCapture.js';
import type { GsiPayload } from '../src/runtime/gsiListener.js';
import type { WatchedGame } from '../src/shared/fearlessDraft.js';

// The capture takes a raw GSI payload (an untyped record) and narrows it internally; the typed
// fixtures here are structurally that, so cross the boundary explicitly.
function asPayload(gsiData: DotaGsiData): GsiPayload {
  return gsiData as unknown as GsiPayload;
}

function gameInProgress(matchid: string, heroIds: number[]): DotaGsiData {
  const heroes: Record<string, { id: number }> = {};
  heroIds.forEach((id, index) => {
    heroes[`player${index}`] = { id };
  });

  return {
    map: { game_state: 'DOTA_GAMERULES_STATE_GAME_IN_PROGRESS', matchid },
    hero: {
      team2: Object.fromEntries(Object.entries(heroes).slice(0, 5)),
      team3: Object.fromEntries(Object.entries(heroes).slice(5))
    }
  };
}

const TEN_HEROES = [1, 8, 11, 14, 19, 22, 25, 31, 35, 41];

test('getPickedHeroIds collects every picked hero across both teams', () => {
  const heroIds = getPickedHeroIds(gameInProgress('123', TEN_HEROES));
  assert.deepEqual(
    [...heroIds].sort((a, b) => a - b),
    [...TEN_HEROES].sort((a, b) => a - b)
  );
});

test('getPickedHeroIds skips empty slots (id 0 or missing)', () => {
  const gsiData: DotaGsiData = {
    hero: {
      team2: { player0: { id: 5 }, player1: { id: 0 }, player2: {} }
    }
  };
  assert.deepEqual(getPickedHeroIds(gsiData), [5]);
});

test('getPickedHeroes pairs each hero with the matching player name', () => {
  const gsiData: DotaGsiData = {
    hero: {
      team2: { player0: { id: 5 }, player1: { id: 8 } }
    },
    player: {
      team2: { player0: { name: 'Dendi' }, player1: { name: 'Puppey' } }
    }
  };
  assert.deepEqual(getPickedHeroes(gsiData), [
    { heroId: 5, playerName: 'Dendi' },
    { heroId: 8, playerName: 'Puppey' }
  ]);
});

test('getDotaGsiMatchId treats "0", empty, and absent as no match', () => {
  assert.equal(getDotaGsiMatchId({ map: { matchid: '0' } }), null);
  assert.equal(getDotaGsiMatchId({ map: { matchid: '' } }), null);
  assert.equal(getDotaGsiMatchId({ map: {} }), null);
  assert.equal(getDotaGsiMatchId({ map: { matchid: '7654321' } }), '7654321');
});

test('bannedHeroIdsFromSeries unions and de-dupes heroes across games', () => {
  const series: SeriesGame[] = [
    { matchId: 'a', heroIds: [1, 2, 3], label: 'a' },
    { matchId: 'b', heroIds: [3, 4, 5], label: 'b' }
  ];
  assert.deepEqual(bannedHeroIdsFromSeries(series), [1, 2, 3, 4, 5]);
});

test('fearless capture records a locked lineup once, deduped by match', () => {
  const captured: WatchedGame[] = [];
  const capture = createFearlessCapture({ upsert: (game) => captured.push(game), now: () => 1000 });

  const payload = asPayload(gameInProgress('999', TEN_HEROES));
  capture.handlePayload(payload);
  capture.handlePayload(payload); // same match again -> no second capture

  assert.equal(captured.length, 1);
  assert.equal(captured[0]?.matchId, '999');
  assert.equal(captured[0]?.capturedAt, 1000);
  assert.equal(captured[0]?.source, 'spectated');
  assert.equal(captured[0]?.heroIds.length, 10);
});

test('fearless capture ignores non-in-progress states and partial lineups', () => {
  const captured: WatchedGame[] = [];
  const capture = createFearlessCapture({ upsert: (game) => captured.push(game) });

  // Draft phase: not captured.
  capture.handlePayload(
    asPayload({ map: { game_state: 'DOTA_GAMERULES_STATE_HERO_SELECTION', matchid: '1' } })
  );
  // In progress but only 9 heroes resolved: not captured.
  capture.handlePayload(asPayload(gameInProgress('2', TEN_HEROES.slice(0, 9))));

  assert.equal(captured.length, 0);
});
