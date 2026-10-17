import assert from 'node:assert/strict';
import test from 'node:test';

import { getTeamPlayerNames } from '../src/overlay/elements/playerNames/playerNamesData.js';
import type { DotaGsiData } from '../src/shared/dotaGsiPayload.js';
import type { KnownPlayer } from '../src/shared/knownPlayer.js';

const PLAYERS: DotaGsiData = {
  player: {
    team2: {
      player4: { accountid: '14', name: 'Fifth' },
      player0: { accountid: '10', name: 'First in-game' },
      player2: { accountid: '12', name: 'Third' },
      player1: { accountid: '11', name: 'Second' },
      player3: { name: 'No account id' }
    },
    team3: {
      player9: { accountid: '19', name: 'Dire fifth' },
      player5: { accountid: '15', name: 'Dire first' },
      player10: { name: 'Additional slot' }
    }
  }
};

const KNOWN_PLAYERS = new Map<string, KnownPlayer>([
  ['10', { accountId: '10', name: 'Saved first', mmr: null, teamId: null }],
  ['11', { accountId: '11', name: '   ', mmr: null, teamId: null }],
  ['15', { accountId: '15', name: 'Saved Dire', mmr: null, teamId: null }]
]);

test('in-game names follow numeric player slots without requiring picked heroes', () => {
  assert.deepEqual(getTeamPlayerNames(PLAYERS, 'team2', 'ingame', KNOWN_PLAYERS), [
    'First in-game',
    'Second',
    'Third',
    'No account id',
    'Fifth'
  ]);
  assert.deepEqual(getTeamPlayerNames(PLAYERS, 'team3', 'ingame', KNOWN_PLAYERS), [
    'Dire first',
    'Dire fifth',
    'Additional slot'
  ]);
});

test('player-list mode matches accounts and falls back for unknown or empty saved names', () => {
  assert.deepEqual(getTeamPlayerNames(PLAYERS, 'team2', 'profile', KNOWN_PLAYERS), [
    'Saved first',
    'Second',
    'Third',
    'No account id',
    'Fifth'
  ]);
  assert.deepEqual(getTeamPlayerNames(PLAYERS, 'team3', 'profile', KNOWN_PLAYERS), [
    'Saved Dire',
    'Dire fifth',
    'Additional slot'
  ]);
});

test('lineups follow live team assignments after a side swap', () => {
  const swapped: DotaGsiData = {
    player: { team2: PLAYERS.player?.team3 ?? {}, team3: PLAYERS.player?.team2 ?? {} }
  };
  assert.equal(getTeamPlayerNames(swapped, 'team2', 'profile', KNOWN_PLAYERS)[0], 'Saved Dire');
  assert.equal(getTeamPlayerNames(swapped, 'team3', 'profile', KNOWN_PLAYERS)[0], 'Saved first');
});

test('missing and partial lineups do not fabricate player names', () => {
  assert.deepEqual(getTeamPlayerNames({}, 'team2', 'profile', KNOWN_PLAYERS), []);
  assert.deepEqual(
    getTeamPlayerNames({ player: { team2: {} } }, 'team3', 'ingame', KNOWN_PLAYERS),
    []
  );
  assert.deepEqual(
    getTeamPlayerNames(
      { player: { team2: { player0: {}, player1: { name: 'Ready' } } } },
      'team2',
      'ingame',
      KNOWN_PLAYERS
    ),
    ['', 'Ready']
  );
});

test('each team is limited to five player names', () => {
  const extra: DotaGsiData = {
    player: { team2: { ...PLAYERS.player?.team2, player12: { name: 'Sixth' } } }
  };
  assert.equal(getTeamPlayerNames(extra, 'team2', 'ingame', KNOWN_PLAYERS).length, 5);
  assert.ok(!getTeamPlayerNames(extra, 'team2', 'ingame', KNOWN_PLAYERS).includes('Sixth'));
});
