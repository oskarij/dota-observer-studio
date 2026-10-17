import assert from 'node:assert/strict';
import test from 'node:test';

import {
  bestOfFromSeriesType,
  resolveCurrentSeries,
  type LeagueMatch
} from '../src/shared/leagueSeries.js';

const HOUR = 60 * 60;
const BASE = 1_700_000_000;

function match(overrides: Partial<LeagueMatch> & { matchId: string }): LeagueMatch {
  return {
    startTime: BASE,
    radiantTeamId: 1,
    direTeamId: 2,
    radiantWin: true,
    seriesId: null,
    seriesType: 1,
    ...overrides
  };
}

test('best-of maps from Valve series types', () => {
  assert.equal(bestOfFromSeriesType(0), 1);
  assert.equal(bestOfFromSeriesType(1), 3);
  assert.equal(bestOfFromSeriesType(2), 5);
  assert.equal(bestOfFromSeriesType(7), null);
  assert.equal(bestOfFromSeriesType(null), null);
});

test('resolves the ongoing series a mid-series join lands in, with the real score', () => {
  // Two finished games of a Bo3 the operator never watched.
  const matches = [
    match({ matchId: '1', startTime: BASE, seriesId: 500, radiantWin: true }),
    match({
      matchId: '2',
      startTime: BASE + HOUR,
      seriesId: 500,
      radiantTeamId: 2,
      direTeamId: 1,
      radiantWin: true
    })
  ];

  const series = resolveCurrentSeries(matches, 1, 2, { seriesId: 500 });

  assert.equal(series?.seriesId, 500);
  assert.equal(series?.bestOf, 3);
  // Game 1: team 1 won as radiant. Game 2: team 2 won as radiant (sides swapped).
  assert.deepEqual(series?.wins, [1, 1]);
  assert.deepEqual(
    series?.games.map((game) => game.matchId),
    ['1', '2']
  );
  assert.equal(series?.games[1]?.winnerTeamId, 2);
});

test('a new series between the same teams is not merged into the previous one', () => {
  const matches = [
    match({ matchId: '1', startTime: BASE, seriesId: 500 }),
    match({ matchId: '2', startTime: BASE + HOUR, seriesId: 500 }),
    // A rematch later in the tournament: different series id.
    match({ matchId: '3', startTime: BASE + 5 * HOUR, seriesId: 600, radiantWin: false })
  ];

  const series = resolveCurrentSeries(matches, 1, 2, { seriesId: 600 });

  assert.equal(series?.seriesId, 600);
  assert.equal(series?.games.length, 1);
  // Team 2 won the only game of the current series.
  assert.deepEqual(series?.wins, [0, 1]);
});

test('matches without series ids are never grouped by their timing', () => {
  const matches = [
    match({ matchId: '1', startTime: BASE }),
    match({ matchId: '2', startTime: BASE + HOUR }),
    // A day later: a different series.
    match({ matchId: '3', startTime: BASE + 24 * HOUR })
  ];

  assert.equal(resolveCurrentSeries(matches, 1, 2), null);
});

test('only matches between the two spectated teams are considered', () => {
  const matches = [
    match({ matchId: '1', startTime: BASE, seriesId: 500 }),
    // Same league, other teams, played in between.
    match({
      matchId: '99',
      startTime: BASE + HOUR,
      radiantTeamId: 7,
      direTeamId: 8,
      seriesId: 700
    }),
    match({ matchId: '2', startTime: BASE + 2 * HOUR, seriesId: 500, radiantWin: false })
  ];

  const series = resolveCurrentSeries(matches, 1, 2, { seriesId: 500 });

  assert.deepEqual(
    series?.games.map((game) => game.matchId),
    ['1', '2']
  );
  assert.deepEqual(series?.wins, [1, 1]);
});

test('the spectated match is excluded, so a replay never bans its own lineup', () => {
  const matches = [
    match({ matchId: '1', startTime: BASE, seriesId: 500, radiantWin: true }),
    match({
      matchId: '2',
      startTime: BASE + HOUR,
      seriesId: 500,
      radiantTeamId: 2,
      direTeamId: 1,
      radiantWin: true
    })
  ];

  // Watching a replay of game 2: only game 1 counts, and the score reads as it stood before it.
  const series = resolveCurrentSeries(matches, 1, 2, { seriesId: 500, anchorMatchId: '2' });

  assert.deepEqual(
    series?.games.map((game) => game.matchId),
    ['1']
  );
  assert.deepEqual(series?.wins, [1, 0]);
  // The format still comes from the whole group.
  assert.equal(series?.bestOf, 3);
});

test('spectating the first game of a series leaves no prior games and no score', () => {
  const series = resolveCurrentSeries(
    [match({ matchId: '1', startTime: BASE, seriesId: 500, seriesType: 1 })],
    1,
    2,
    { seriesId: 500, anchorMatchId: '1' }
  );

  assert.deepEqual(series?.games, []);
  assert.deepEqual(series?.wins, [0, 0]);
  assert.equal(series?.bestOf, 3);
});

test('an unplayed matchup resolves to nothing rather than an empty series', () => {
  assert.equal(resolveCurrentSeries([], 1, 2), null);
  assert.equal(resolveCurrentSeries([match({ matchId: '1' })], 3, 4), null);
});
