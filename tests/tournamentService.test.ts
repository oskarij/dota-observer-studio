import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createTournamentService,
  type PersistedTournament
} from '../src/runtime/tournamentService.js';
import type { LeagueMatchesFetchResult } from '../src/runtime/valveClient.js';
import type { DotaGsiData } from '../src/shared/dotaGsiPayload.js';
import type { LeagueMatch, TournamentSeries } from '../src/shared/leagueSeries.js';
import { readMatchContext, type MatchContext } from '../src/shared/matchContext.js';

const heroes = (start: number) => Array.from({ length: 10 }, (_, index) => start + index);

function match(matchId: string, seriesId: number, radiantWin: boolean | null): LeagueMatch {
  return {
    matchId,
    startTime: Number(matchId),
    radiantTeamId: 1,
    direTeamId: 2,
    radiantWin,
    seriesId,
    seriesType: 1,
    heroIds: heroes(Number(matchId))
  };
}

function harness(stored: PersistedTournament = { matches: [] }) {
  let persisted = stored;
  const calls: { leagueId: number; seriesId: number }[] = [];
  const pending: ((result: LeagueMatchesFetchResult) => void)[] = [];
  const scheduled: (() => void)[] = [];
  const delays: number[] = [];
  const published: (TournamentSeries | null)[] = [];
  let failConsumer = false;
  let context: MatchContext | undefined = undefined;
  const service = createTournamentService({
    store: {
      get: () => persisted,
      set: (next) => {
        persisted = next;
      }
    },
    fetchLeagueMatches: (leagueId, options) => {
      calls.push({ leagueId, seriesId: options.seriesId });
      return new Promise((resolve) => pending.push(resolve));
    },
    cachedHeroIds: () => null,
    onSeriesChanged: (series) => {
      if (failConsumer) throw new Error('Consumer failed');
      published.push(series);
    },
    notifyChanged() {},
    schedule: (run, delayMs) => {
      scheduled.push(run);
      delays.push(delayMs);
      return () => {};
    }
  });
  return {
    service,
    calls,
    delays,
    published,
    stored: () => persisted,
    send(data: DotaGsiData): void {
      context = readMatchContext(data, context);
      service.handleContext(context);
    },
    async answer(result: LeagueMatchesFetchResult): Promise<void> {
      pending.shift()?.(result);
      await new Promise((done) => setImmediate(done));
    },
    async runRetry(): Promise<void> {
      scheduled.shift()?.();
      await new Promise((done) => setImmediate(done));
    },
    failConsumer(fail: boolean): void {
      failConsumer = fail;
    }
  };
}

function live(matchid: string, seriesId: number | null, wins?: [number, number]): DotaGsiData {
  const side = (teamId: number, index: number) => ({
    team_id: teamId,
    name: teamId === 1 ? 'Alpha' : 'Beta',
    ...(wins === undefined ? {} : { series_wins: wins[index] })
  });
  return {
    map: { game_state: 'DOTA_GAMERULES_STATE_HERO_SELECTION', matchid },
    league: {
      league_id: 9,
      name: 'Test League',
      ...(seriesId === null ? {} : { series_id: seriesId }),
      radiant: side(1, 0),
      dire: side(2, 1)
    }
  };
}

test('a live ticket loads the earlier games of exactly its series', async () => {
  const h = harness();
  h.send(live('300', 10, [1, 0]));
  assert.deepEqual(h.calls, [{ leagueId: 9, seriesId: 10 }]);
  await h.answer({
    outcome: 'resolved',
    matches: [match('100', 10, true), match('200', 11, false), match('400', 10, null)]
  });
  const series = h.published.at(-1);
  assert.deepEqual(
    series?.games.map((game) => game.matchId),
    ['100'],
    'other series and later games are left out'
  );
  assert.deepEqual(
    series?.teams.map((team) => [team.name, team.wins]),
    [
      ['Alpha', 1],
      ['Beta', 0]
    ]
  );
  assert.equal(h.service.getState().league?.name, 'Test League');
  assert.equal(h.service.getState().message, null);
});

test('without ticket scores the wins come from completed results', async () => {
  const h = harness();
  h.send(live('300', 10));
  await h.answer({
    outcome: 'resolved',
    matches: [match('100', 10, true), match('200', 10, false)]
  });
  assert.deepEqual(
    h.published.at(-1)?.teams.map((team) => team.wins),
    [1, 1]
  );
  assert.equal(h.published.at(-1)?.scoresComplete, true);
});

test('repeated payloads and menus between games neither refetch nor drop the series', async () => {
  const h = harness();
  h.send(live('300', 10, [1, 0]));
  await h.answer({ outcome: 'resolved', matches: [match('100', 10, true)] });
  for (let index = 0; index < 50; index++) h.send(live('300', 10, [1, 0]));
  h.send({ map: { game_state: 'DOTA_GAMERULES_STATE_INIT', matchid: '0' } });
  assert.equal(h.calls.length, 1);
  assert.notEqual(h.published.at(-1), null);
});

test('a response for a series the operator has moved on from is cached but not applied', async () => {
  const h = harness();
  h.send(live('300', 10, [1, 0]));
  h.send(live('500', 12, [0, 0]));
  await h.answer({ outcome: 'resolved', matches: [match('100', 10, true)] });
  assert.equal(h.published.at(-1), null);
  assert.deepEqual(
    h.stored().matches.map((cached) => cached.matchId),
    ['100']
  );
  h.send(live('300', 10, [1, 0]));
  assert.deepEqual(
    h.published.at(-1)?.games.map((game) => game.matchId),
    ['100'],
    'returning shows the cached games at once'
  );
});

test('without a Steam key it says so and does not retry', async () => {
  const h = harness();
  h.send(live('300', 10, [1, 0]));
  await h.answer({ outcome: 'no-key' });
  assert.match(h.service.getState().message ?? '', /Steam Web API key/);
  assert.equal(h.delays.length, 0);
});

test('an unavailable or incomplete history retries with backoff until it is complete', async () => {
  const h = harness();
  h.send(live('300', 10));
  await h.answer({ outcome: 'transient' });
  assert.match(h.service.getState().message ?? '', /unavailable/);
  await h.runRetry();
  await h.answer({ outcome: 'resolved', matches: [match('100', 10, null)] });
  assert.match(h.service.getState().message ?? '', /pending/);
  await h.runRetry();
  await h.answer({ outcome: 'resolved', matches: [match('100', 10, true)] });
  assert.equal(h.service.getState().message, null);
  assert.deepEqual(h.delays, [30_000, 60_000]);
});

test('a consumer that failed receives the same series again', async () => {
  const h = harness();
  h.send(live('300', 10, [1, 0]));
  h.failConsumer(true);
  await h.answer({ outcome: 'resolved', matches: [match('100', 10, true)] });
  h.failConsumer(false);
  await h.runRetry();
  await h.answer({ outcome: 'resolved', matches: [match('100', 10, true)] });
  assert.deepEqual(
    h.published.at(-1)?.games.map((game) => game.matchId),
    ['100']
  );
});

test('a ticket without a series id or team ids requests no history', () => {
  const h = harness();
  h.send(live('300', null, [0, 0]));
  h.send({ map: { game_state: 'DOTA_GAMERULES_STATE_HERO_SELECTION', matchid: '400' } });
  assert.equal(h.calls.length, 0);
  assert.equal(h.published.at(-1), null);
});

test('a refresh during a load shares it', async () => {
  const h = harness();
  h.send(live('300', 10, [1, 0]));
  const first = h.service.refresh();
  const second = h.service.refresh();
  assert.equal(first, second);
  assert.equal(h.calls.length, 1);
  await h.answer({ outcome: 'resolved', matches: [] });
  assert.deepEqual(await first, { ok: true });
});
