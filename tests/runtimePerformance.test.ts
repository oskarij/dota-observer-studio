import assert from 'node:assert/strict';
import test from 'node:test';
import { createPlayerRankService } from '../src/runtime/playerRankService.js';
import { createSeriesStateService } from '../src/runtime/seriesStateService.js';
import type { DotaGsiData } from '../src/shared/dotaGsiPayload.js';
import { readMatchContext } from '../src/shared/matchContext.js';
import { createDefaultSeriesState, type SeriesStatePayload } from '../src/shared/seriesState.js';
import type { Team } from '../src/shared/team.js';

test('selected-player ticks read a fresh rank once, and explicit cache clearing invalidates memory', () => {
  let reads = 0;
  let tier = 74;
  let time = 1_000;
  const pushed: (number | null)[] = [];
  const service = createPlayerRankService({
    now: () => time,
    store: {
      get: () => {
        reads++;
        return { rankTier: tier, fetchedAt: time };
      },
      set() {},
      deleteAll() {},
      close() {}
    },
    sink: { setPlayerRank: (rank) => pushed.push(rank.rankTier) }
  });
  const payload = {
    map: { game_state: 'DOTA_GAMERULES_STATE_GAME_IN_PROGRESS' },
    hero: { team2: { player0: { selected_unit: true } } },
    player: { team2: { player0: { accountid: '123' } } }
  };
  for (let i = 0; i < 600; i++) service.handlePayload(payload);
  assert.equal(reads, 1);
  assert.deepEqual(pushed, [74]);
  tier = 80;
  service.clearSessionCache();
  service.handlePayload(payload);
  assert.equal(reads, 2);
  assert.deepEqual(pushed, [74, 80]);
  time += 8 * 24 * 60 * 60 * 1000;
  service.handlePayload(payload);
  assert.equal(reads, 3, 'long-running sessions still respect the rank TTL');
});

test('steady league traffic does no repeated work; edits and score changes still update', () => {
  let reads = 0;
  let writes = 0;
  let teams: Team[] = [
    { id: 'a', name: 'A', tag: 'A', externalTeamId: 1, logoPath: null },
    { id: 'b', name: 'B', tag: 'B', externalTeamId: 2, logoPath: null }
  ];
  const pushes: SeriesStatePayload[] = [];
  const service = createSeriesStateService({
    store: {
      get: () => createDefaultSeriesState(),
      set: () => {
        writes++;
      }
    },
    teams: () => {
      reads++;
      return structuredClone(teams);
    },
    upsertTeam: () => {
      throw Error('Existing teams must be reused');
    },
    knownPlayers: () => [],
    sink: { setSeriesState: (state) => pushes.push(state) }
  });
  const payload = {
    map: { game_state: 'DOTA_GAMERULES_STATE_GAME_IN_PROGRESS', matchid: '123' },
    league: {
      radiant: { team_id: 1, name: 'A', series_wins: 1 },
      dire: { team_id: 2, name: 'B', series_wins: 0 }
    }
  } as const;
  let context = readMatchContext(payload);
  service.handleContext(context);
  const readsAfterFirst = reads;
  for (let i = 0; i < 600; i++) {
    context = readMatchContext(
      { ...structuredClone(payload), provider: { timestamp: i } } as DotaGsiData,
      context
    );
    service.handleContext(context);
  }
  assert.equal(reads, readsAfterFirst);
  assert.equal(writes, 1);
  assert.equal(pushes.length, 1);
  teams = teams.map((team) => ({ ...team, logoPath: '/media/new-logo.png' }));
  service.refresh();
  assert.equal(pushes.at(-1)?.radiant.logoPath, '/media/new-logo.png');
  service.handleContext(
    readMatchContext(
      {
        ...payload,
        league: { ...payload.league, radiant: { ...payload.league.radiant, series_wins: 2 } }
      },
      context
    )
  );
  assert.equal(pushes.at(-1)?.radiant.score, 2);
});

test('rank write failures back off without an unhandled rejection, and pending requests cannot outlive cache clearing or shutdown', async () => {
  let time = 1000;
  let fail = true;
  let writes = 0;
  const finish: ((result: { outcome: 'resolved'; rankTier: number }) => void)[] = [];
  const service = createPlayerRankService({
    now: () => time,
    fetchRank: () => new Promise((resolve) => finish.push(resolve)),
    store: {
      get: () => null,
      set() {
        if (fail) throw new Error('Disk full');
        writes++;
      },
      deleteAll() {},
      close() {}
    },
    sink: { setPlayerRank() {} }
  });
  const payload = {
    map: { game_state: 'DOTA_GAMERULES_STATE_GAME_IN_PROGRESS' },
    hero: { team2: { player0: { selected_unit: true } } },
    player: { team2: { player0: { accountid: '123' } } }
  };
  const settle = () => new Promise((resolve) => setImmediate(resolve));
  service.handlePayload(payload);
  finish[0]?.({ outcome: 'resolved', rankTier: 74 });
  await settle();
  service.handlePayload(payload);
  assert.equal(finish.length, 1);
  fail = false;
  time += 120_000;
  service.handlePayload(payload);
  service.clearSessionCache();
  finish[1]?.({ outcome: 'resolved', rankTier: 74 });
  await settle();
  assert.equal(writes, 0);
  service.handlePayload(payload);
  service.dispose();
  assert.equal(finish.length, 3);
  finish[2]?.({ outcome: 'resolved', rankTier: 74 });
  await settle();
  assert.equal(writes, 0);
});
