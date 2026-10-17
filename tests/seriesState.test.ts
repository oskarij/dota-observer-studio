import assert from 'node:assert/strict';
import test from 'node:test';

import { createSeriesStateService } from '../src/runtime/seriesStateService.js';
import type { DotaGsiData, DotaGsiLeague } from '../src/shared/dotaGsiPayload.js';
import type { KnownPlayer } from '../src/shared/knownPlayer.js';
import { readMatchContext, type MatchContext } from '../src/shared/matchContext.js';
import {
  createDefaultSeriesState,
  type PersistedSeriesState,
  type SeriesStatePayload
} from '../src/shared/seriesState.js';
import type { Team } from '../src/shared/team.js';

function team(id: string, name: string, externalTeamId: number | null = null): Team {
  return { id, name, tag: '', logoPath: null, externalTeamId };
}

function player(accountId: string, teamId: string): KnownPlayer {
  return { accountId, name: `p${accountId}`, mmr: null, teamId };
}

function createHarness(options?: { state?: unknown; teams?: Team[]; players?: KnownPlayer[] }) {
  let persisted: unknown = options?.state ?? createDefaultSeriesState();
  const teams = options?.teams ?? [];
  const payloads: SeriesStatePayload[] = [];
  const newSeries: (string | null)[] = [];
  let failWrites = false;
  let ids = 0;
  let context: MatchContext | undefined = undefined;
  const service = createSeriesStateService({
    store: {
      get: () => persisted,
      set: (next) => {
        if (failWrites) throw new Error('Disk full');
        persisted = structuredClone(next);
      }
    },
    teams: () => teams,
    upsertTeam: (next) => {
      const index = teams.findIndex((existing) => existing.id === next.id);
      if (index === -1) teams.push(next);
      else teams[index] = next;
    },
    knownPlayers: () => options?.players ?? [],
    sink: { setSeriesState: (payload) => payloads.push(payload) },
    onNewSeries: (key) => newSeries.push(key),
    newTeamId: () => `saved-${String((ids += 1))}`
  });
  return {
    service,
    teams,
    newSeries,
    state: () => persisted as PersistedSeriesState,
    overlay: () => payloads.at(-1),
    pushes: () => payloads.length,
    snapshot: () => service.getSnapshot(),
    send(data: DotaGsiData): void {
      context = readMatchContext(data, context);
      service.handleContext(context);
    },
    failWrites(fail: boolean): void {
      failWrites = fail;
    }
  };
}

type TicketTeam = [teamId: number | null, name: string, wins?: number];
function ticket(seriesId: number | null, radiant: TicketTeam, dire: TicketTeam): DotaGsiLeague {
  const side = ([teamId, name, wins]: TicketTeam) => ({
    ...(teamId === null ? {} : { team_id: teamId }),
    name,
    ...(wins === undefined ? {} : { series_wins: wins })
  });
  return {
    league_id: 9,
    name: 'Test League',
    ...(seriesId === null ? {} : { series_id: seriesId }),
    radiant: side(radiant),
    dire: side(dire)
  };
}

function draft(matchid: string, league?: DotaGsiLeague, extra?: Partial<DotaGsiData>): DotaGsiData {
  return {
    map: { game_state: 'DOTA_GAMERULES_STATE_HERO_SELECTION', matchid },
    ...(league === undefined ? {} : { league }),
    ...extra
  };
}

function postGame(
  matchid: string,
  winner: 'radiant' | 'dire',
  league?: DotaGsiLeague
): DotaGsiData {
  return {
    map: { game_state: 'DOTA_GAMERULES_STATE_POST_GAME', matchid, win_team: winner },
    ...(league === undefined ? {} : { league })
  };
}

const menus: DotaGsiData = { map: { game_state: 'DOTA_GAMERULES_STATE_INIT', matchid: '0' } };

function playersBlock(radiantIds: string[], direIds: string[]): Pick<DotaGsiData, 'player'> {
  const side = (ids: string[], offset: number) =>
    Object.fromEntries(ids.map((id, index) => [`player${offset + index}`, { accountid: id }]));
  return { player: { team2: side(radiantIds, 0), team3: side(direIds, 5) } };
}

test('a ticket shows its teams on its sides with its score, saving them for logos', () => {
  const h = createHarness();
  h.send(draft('100', ticket(10, [1, 'Alpha', 1], [2, 'Beta', 0])));
  assert.deepEqual(h.overlay(), {
    radiant: { name: 'Alpha', logoPath: null, score: 1 },
    dire: { name: 'Beta', logoPath: null, score: 0 },
    seriesConfigured: true
  });
  assert.deepEqual(
    h.teams.map((saved) => [saved.name, saved.externalTeamId]),
    [
      ['Alpha', 1],
      ['Beta', 2]
    ]
  );
  assert.equal(h.snapshot().scoreSource, 'ticket');
  assert.equal(h.snapshot().league?.name, 'Test League');
});

test('a saved team linked by Valve id supplies the name and logo', () => {
  const h = createHarness({
    teams: [{ ...team('mine', 'My Alpha', 1), logoPath: '/media/team-logos/alpha.png' }]
  });
  h.send(draft('100', ticket(10, [1, 'ALPHA ticket name'], [2, 'Beta'])));
  assert.equal(h.overlay()?.radiant.name, 'My Alpha');
  assert.equal(h.overlay()?.radiant.logoPath, '/media/team-logos/alpha.png');
  assert.equal(h.teams.length, 2, 'only the unknown team is added');
});

// The live tournament: Bo1 lobbies carry no series id, so their teams identify the series.
test('a Bo1 sharing one team with the previous Bo1 replaces the teams and the score', () => {
  const h = createHarness();
  h.send(draft('100', ticket(null, [1, 'Alpha'], [2, 'Beta'])));
  h.send(postGame('100', 'radiant', ticket(null, [1, 'Alpha'], [2, 'Beta'])));
  assert.equal(h.overlay()?.radiant.score, 1);
  h.send(draft('200', ticket(null, [3, 'Gamma'], [1, 'Alpha'])));
  assert.equal(h.overlay()?.radiant.name, 'Gamma');
  assert.equal(h.overlay()?.dire.name, 'Alpha');
  assert.equal(h.overlay()?.dire.score, 0);
  assert.equal(h.newSeries.length, 2);
});

test('a Bo1 after a Bo3 replaces the Bo3 teams', () => {
  const h = createHarness();
  h.send(draft('100', ticket(10, [1, 'Alpha', 0], [2, 'Beta', 1])));
  h.send(draft('200', ticket(null, [3, 'Gamma'], [2, 'Beta'])));
  assert.equal(h.overlay()?.radiant.name, 'Gamma');
  assert.equal(h.overlay()?.dire.name, 'Beta');
  assert.equal(h.overlay()?.dire.score, 0);
});

test('the same Bo1 matchup again continues; a new series id between the same teams does not', () => {
  const h = createHarness();
  h.send(draft('100', ticket(null, [1, 'Alpha'], [2, 'Beta'])));
  h.send(draft('200', ticket(null, [2, 'Beta'], [1, 'Alpha'])));
  assert.equal(h.newSeries.length, 1);
  h.send(draft('300', ticket(10, [1, 'Alpha'], [2, 'Beta'])));
  h.send(draft('400', ticket(11, [1, 'Alpha'], [2, 'Beta'])));
  assert.deepEqual(h.newSeries, ['9:teams:valve:1|valve:2', '9:series:10', '9:series:11']);
});

test('menus between games keep the series on screen', () => {
  const h = createHarness();
  h.send(draft('100', ticket(10, [1, 'Alpha', 1], [2, 'Beta', 0])));
  const pushes = h.pushes();
  h.send(menus);
  h.send({ map: { game_state: 'DOTA_GAMERULES_STATE_WAIT_FOR_PLAYERS_TO_LOAD', matchid: '200' } });
  assert.equal(h.pushes(), pushes);
  assert.equal(h.overlay()?.radiant.name, 'Alpha');
  assert.equal(h.newSeries.length, 1);
});

test('teams picked by hand apply to lobbies without a ticket; a ticket always wins', () => {
  const h = createHarness({ teams: [team('x', 'Xeno'), team('y', 'Yotta')] });
  h.service.setManualTeam('radiant', 'x');
  h.service.setManualTeam('dire', 'y');
  assert.equal(h.overlay()?.radiant.name, 'Xeno');
  h.send(draft('100', ticket(10, [1, 'Alpha'], [2, 'Beta'])));
  assert.equal(h.overlay()?.radiant.name, 'Alpha');
  assert.equal(h.snapshot().mode, 'ticket');
  h.service.setManualTeam('radiant', 'y');
  assert.equal(h.overlay()?.radiant.name, 'Alpha');
  h.send(draft('200'));
  assert.equal(h.snapshot().mode, 'manual');
  assert.equal(h.overlay()?.radiant.name, 'Yotta');
  assert.equal(h.overlay()?.dire.name, '');
});

test('linked players place the manual teams once per match; a manual swap sticks for it', () => {
  const players = [player('1', 'x'), player('2', 'x'), player('3', 'y'), player('4', 'y')];
  const h = createHarness({ teams: [team('x', 'Xeno'), team('y', 'Yotta')], players });
  h.send(draft('100', undefined, playersBlock(['3', '4'], ['1', '2'])));
  assert.equal(h.overlay()?.radiant.name, 'Yotta');
  assert.equal(h.overlay()?.dire.name, 'Xeno');
  h.service.swapManualSides();
  h.send({ ...draft('100', undefined, playersBlock(['3', '4'], ['1', '2'])), hero: {} });
  assert.equal(h.overlay()?.radiant.name, 'Xeno');
  h.send(draft('200', undefined, playersBlock(['3', '4'], ['1', '2'])));
  assert.equal(h.overlay()?.radiant.name, 'Yotta');
  assert.equal(h.newSeries.length, 1, 'swapping sides keeps the series');
});

test('a single linked player is not enough to place a team', () => {
  const players = [player('1', 'x'), player('3', 'y'), player('4', 'y')];
  const h = createHarness({ teams: [team('x', 'Xeno'), team('y', 'Yotta')], players });
  h.service.setManualTeam('radiant', 'x');
  h.service.setManualTeam('dire', 'y');
  h.send(draft('100', undefined, playersBlock(['1'], ['3', '4'])));
  assert.equal(h.overlay()?.radiant.name, 'Xeno');
  h.send(draft('200', undefined, playersBlock(['3', '4'], ['1'])));
  assert.equal(h.overlay()?.radiant.name, 'Yotta', 'one recognised side is enough to swap');
});

test('a ticketed win without ticket scores is counted once, under the series it belongs to', () => {
  const h = createHarness();
  const league = ticket(10, [1, 'Alpha'], [2, 'Beta']);
  h.send(draft('100', league));
  h.send(postGame('100', 'dire', league));
  h.send(postGame('100', 'dire', league));
  assert.equal(h.overlay()?.dire.score, 1);
  assert.equal(h.snapshot().scoreSource, 'count');
  h.send(postGame('200', 'radiant', ticket(11, [3, 'Gamma'], [4, 'Delta'])));
  assert.equal(h.overlay()?.radiant.name, 'Gamma');
  assert.equal(h.overlay()?.radiant.score, 1);
  assert.equal(h.overlay()?.dire.score, 0);
});

test('games without a ticket are never counted', () => {
  const h = createHarness({ teams: [team('x', 'Xeno'), team('y', 'Yotta')] });
  h.service.setManualTeam('radiant', 'x');
  h.service.setManualTeam('dire', 'y');
  h.send(postGame('100', 'radiant'));
  assert.equal(h.overlay()?.radiant.score, 0);
});

test('scores: manual over ticket over history over counted, edited from what is shown', () => {
  const h = createHarness();
  h.send(draft('100', ticket(10, [1, 'Alpha'], [2, 'Beta'])));
  h.service.setHistoryWins({ 1: 2 });
  assert.equal(h.snapshot().scoreSource, 'count', 'history needs both teams');
  h.service.setHistoryWins({ 1: 2, 2: 1 });
  assert.equal(h.snapshot().scoreSource, 'history');
  h.send(draft('100', ticket(10, [1, 'Alpha', 0], [2, 'Beta', 1])));
  assert.equal(h.snapshot().scoreSource, 'ticket');
  h.service.adjustScore('radiant', 1);
  assert.deepEqual([h.overlay()?.radiant.score, h.overlay()?.dire.score], [1, 1]);
  h.send(draft('100', ticket(10, [1, 'Alpha', 0], [2, 'Beta', 2])));
  assert.equal(h.overlay()?.dire.score, 1, 'the operator score holds against the ticket');
  h.service.resetScores();
  assert.deepEqual([h.overlay()?.radiant.score, h.overlay()?.dire.score], [0, 0]);
  h.service.useAutomaticScore();
  assert.equal(h.overlay()?.dire.score, 2);
  h.service.adjustScore('dire', -1);
  h.send(draft('200', ticket(12, [1, 'Alpha'], [2, 'Beta'])));
  assert.equal(h.snapshot().scoreSource, 'count', 'a new series drops the operator score');
});

test('scores are clamped at zero and need a team on the side', () => {
  const h = createHarness({ teams: [team('x', 'Xeno')] });
  h.service.setManualTeam('radiant', 'x');
  h.service.adjustScore('radiant', -1);
  assert.equal(h.overlay()?.radiant.score, 0);
  assert.throws(() => h.service.adjustScore('dire', 1), /no team/);
});

test('a team picked for both sides leaves the other side', () => {
  const h = createHarness({ teams: [team('x', 'Xeno'), team('y', 'Yotta')] });
  h.service.setManualTeam('radiant', 'x');
  h.service.setManualTeam('dire', 'x');
  assert.deepEqual(h.snapshot().manual, { radiant: null, dire: 'x' });
  assert.throws(() => h.service.setManualTeam('radiant', 'gone'), /no longer exists/);
});

test('the overlay reports no series until both sides are known', () => {
  const h = createHarness();
  h.send(draft('100', { league_id: 9, series_id: 10, radiant: { team_id: 1, name: 'Alpha' } }));
  assert.equal(h.overlay()?.seriesConfigured, false);
  h.send(draft('100', ticket(10, [1, 'Alpha'], [2, 'Beta'])));
  assert.equal(h.overlay()?.seriesConfigured, true);
  assert.equal(h.newSeries.length, 1, 'a late second team keeps the series');
});

test('a ticket team without a Valve id is shown by name and not saved', () => {
  const h = createHarness();
  h.send(draft('100', ticket(null, [null, 'Pickup'], [2, 'Beta'])));
  assert.equal(h.overlay()?.radiant.name, 'Pickup');
  assert.deepEqual(
    h.teams.map((saved) => saved.name),
    ['Beta']
  );
});

test('a failed save changes nothing and the same payload retries it', () => {
  const h = createHarness();
  h.send(draft('100', ticket(10, [1, 'Alpha'], [2, 'Beta'])));
  h.failWrites(true);
  assert.throws(() => h.send(draft('200', ticket(11, [3, 'Gamma'], [4, 'Delta']))), /Disk full/);
  assert.equal(h.overlay()?.radiant.name, 'Alpha');
  assert.equal(h.state().key, '9:series:10');
  assert.equal(h.newSeries.length, 1);
  h.failWrites(false);
  h.send(draft('200', ticket(11, [3, 'Gamma'], [4, 'Delta'])));
  assert.equal(h.overlay()?.radiant.name, 'Gamma');
  assert.equal(h.newSeries.length, 2);
});

test('the series survives a restart; state from an older version starts fresh', () => {
  const first = createHarness();
  first.send(draft('100', ticket(10, [1, 'Alpha'], [2, 'Beta'])));
  first.service.adjustScore('dire', 1);
  const restarted = createHarness({ state: first.state(), teams: first.teams });
  assert.equal(restarted.snapshot().sides.dire?.score, 1);
  assert.equal(restarted.snapshot().sides.radiant?.name, 'Alpha');
  const legacy = createHarness({ state: { slots: { A: 'a', B: 'b' }, scores: { A: 2, B: 0 } } });
  assert.deepEqual(legacy.snapshot().sides, { radiant: null, dire: null });
});
