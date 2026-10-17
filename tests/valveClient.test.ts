import assert from 'node:assert/strict';
import test from 'node:test';
import { createValveClient } from '../src/runtime/valveClient.js';

const players = Array.from({ length: 10 }, (_, i) => ({
  player_slot: i < 5 ? i : i + 123,
  hero_id: i + 1
}));
const history = (id = 100, series = 7) => ({
  match_id: id,
  match_seq_num: id + 1000,
  start_time: id,
  radiant_team_id: 1,
  dire_team_id: 2,
  series_id: series,
  series_type: 1,
  players
});
const response = (value: unknown) => Promise.resolve(new Response(JSON.stringify(value)));
function urlOf(input: Parameters<typeof fetch>[0]): URL {
  if (typeof input === 'string') return new URL(input);
  return input instanceof URL ? input : new URL(input.url);
}
const options = { seriesId: 7, includeResults: false, excludeMatchId: '200' };

test('malformed history entries and players cannot crash lookups or become complete picks', async () => {
  const client = createValveClient(
    () =>
      response({
        result: {
          status: 1,
          matches: [null, false, { ...history(), players: [null, ...players.slice(1)] }]
        }
      }),
    () => 'unit-test-key'
  );
  const result = await client.fetchLeagueMatches(9, options);
  assert.equal(result.outcome, 'resolved');
  if (result.outcome === 'resolved') {
    assert.deepEqual(result.matches[0]?.heroIds, []);
    assert.equal(result.pending, true);
  }
  assert.equal((await client.fetchMatchInfo('100', 9)).outcome, 'not-found');
});

test('duplicate heroes and fractional player slots do not qualify as a complete lineup', async () => {
  for (const invalid of [
    players.map((p) => ({ ...p, hero_id: 1 })),
    players.map((p) => ({ ...p, player_slot: p.player_slot + 0.5 }))
  ]) {
    const client = createValveClient(
      () => response({ result: { status: 1, matches: [{ ...history(), players: invalid }] } }),
      () => 'unit-test-key'
    );
    assert.equal((await client.fetchMatchInfo('100', 9)).outcome, 'not-found');
  }
});

test('Valve history supplies exact-series picks without fetching winners when ticket scores exist', async () => {
  const calls: URL[] = [];
  const client = createValveClient(
    (input, init) => {
      const url = urlOf(input);
      calls.push(url);
      assert.equal(url.searchParams.has('key'), false);
      assert.equal(new Headers(init?.headers).get('x-webapi-key'), 'unit-test-key');
      assert.ok(init?.signal);
      return response({ result: { status: 1, matches: [history(), history(99, 6)] } });
    },
    () => 'unit-test-key'
  );
  const result = await client.fetchLeagueMatches(9, options);
  assert.equal(result.outcome, 'resolved');
  if (result.outcome !== 'resolved') return;
  assert.deepEqual(
    result.matches.map((m) => m.matchId),
    ['100']
  );
  assert.deepEqual(result.matches[0]?.heroIds, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal(result.matches[0]?.radiantWin, null);
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.searchParams.get('league_id'), '9');
  const manual = await client.fetchMatchInfo('100');
  assert.equal(manual.outcome, 'resolved');
  assert.equal(calls.length, 1, 'cached picks were unnecessarily fetched again');
});

test('history pagination finds an older exact series without pulling unrelated results', async () => {
  const cursors: (string | null)[] = [];
  const client = createValveClient(
    (input) => {
      const url = urlOf(input);
      assert.ok(url.pathname.includes('GetMatchHistory/'));
      cursors.push(url.searchParams.get('start_at_match_id'));
      return response({
        result: {
          status: 1,
          results_remaining: cursors.length === 1 ? 1 : 0,
          matches:
            cursors.length === 1
              ? Array.from({ length: 100 }, (_, i) => history(300 - i, 8))
              : [history()]
        }
      });
    },
    () => 'unit-test-key'
  );
  const result = await client.fetchLeagueMatches(9, options);
  assert.deepEqual(cursors, [null, '200']);
  assert.equal(result.outcome, 'resolved');
  if (result.outcome === 'resolved')
    assert.deepEqual(
      result.matches.map((m) => m.matchId),
      ['100']
    );
});

test('result lookup rejects a neighbouring sequence and retries until the exact result exists', async () => {
  let sequences = 0;
  const client = createValveClient(
    (input) => {
      if (urlOf(input).href.includes('GetMatchHistoryBySequenceNum')) {
        sequences++;
        return response({
          result: {
            status: 1,
            matches: [{ ...history(sequences === 1 ? 101 : 100), leagueid: 9, radiant_win: false }]
          }
        });
      }
      return response({ result: { status: 1, matches: [history()] } });
    },
    () => 'unit-test-key'
  );
  const first = await client.fetchLeagueMatches(9, { ...options, includeResults: true });
  assert.equal(first.outcome, 'resolved');
  if (first.outcome === 'resolved') {
    assert.equal(first.matches[0]?.radiantWin, null);
    assert.equal(first.pending, true);
  }
  const second = await client.fetchLeagueMatches(9, { ...options, includeResults: true });
  assert.equal(second.outcome, 'resolved');
  if (second.outcome === 'resolved') assert.equal(second.matches[0]?.radiantWin, false);
  await client.fetchLeagueMatches(9, { ...options, includeResults: true });
  assert.equal(sequences, 2, 'a cached confirmed winner was requested again');
});

test('manual match lookup refuses the closest match and incomplete picks', async () => {
  let calls = 0;
  const client = createValveClient(
    () => {
      calls++;
      return response({
        result: {
          status: 1,
          matches: [{ ...history(calls === 1 ? 99 : 100), players: players.slice(0, 9) }]
        }
      });
    },
    () => 'unit-test-key'
  );
  assert.equal((await client.fetchMatchInfo('100')).outcome, 'not-found');
  assert.equal((await client.fetchMatchInfo('100')).outcome, 'not-found');
});

test('an uncached manual lookup includes the selected league for tournament games', async () => {
  const client = createValveClient(
    (input) => {
      const url = urlOf(input);
      assert.equal(url.searchParams.get('league_id'), '19978');
      assert.equal(url.searchParams.get('start_at_match_id'), '100');
      return response({ result: { status: 1, matches: [history()] } });
    },
    () => 'unit-test-key'
  );
  const result = await client.fetchMatchInfo('100', 19978);
  assert.equal(result.outcome, 'resolved');
  if (result.outcome === 'resolved') assert.equal(result.heroIds.length, 10);
});

test('concurrent manual lookups share one request; a 429 prevents immediate retries', async () => {
  let calls = 0;
  const client = createValveClient(
    () => {
      calls++;
      return Promise.resolve(new Response('', { status: 429, headers: { 'retry-after': '60' } }));
    },
    () => 'unit-test-key'
  );
  const results = await Promise.all([client.fetchMatchInfo('100'), client.fetchMatchInfo('100')]);
  assert.deepEqual(
    results.map((result) => result.outcome),
    ['transient', 'transient']
  );
  assert.equal((await client.fetchMatchInfo('100')).outcome, 'transient');
  assert.equal(calls, 1);
});

test('the spectated game and later games never trigger winner fetches', async () => {
  const client = createValveClient(
    (input) => {
      assert.ok(urlOf(input).href.includes('GetMatchHistory/'));
      return response({ result: { status: 1, matches: [history(200), history(201)] } });
    },
    () => 'unit-test-key'
  );
  const result = await client.fetchLeagueMatches(9, { ...options, includeResults: true });
  assert.equal(result.outcome, 'resolved');
});

test('without an operator key Steam is never called', async () => {
  let calls = 0;
  const client = createValveClient(
    () => {
      calls += 1;
      return response({});
    },
    () => null
  );
  assert.equal((await client.fetchMatchInfo('100', 9)).outcome, 'no-key');
  assert.equal((await client.fetchLeagueMatches(9, options)).outcome, 'no-key');
  assert.equal(calls, 0);
});
