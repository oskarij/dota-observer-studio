import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';

import { createKnownPlayersStore } from '../src/persistence/knownPlayersStore.js';
import { createTeamsStore } from '../src/persistence/teamsStore.js';

test('a fresh install starts with an empty roster', () => {
  const dir = mkdtempSync(join(tmpdir(), 'roster-'));
  try {
    const players = createKnownPlayersStore(join(dir, 'players.db'));
    const teams = createTeamsStore(join(dir, 'teams.db'));
    assert.deepEqual(players.list(), []);
    assert.deepEqual(teams.list(), []);
    players.close();
    teams.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a database from before team links keeps its players and gains the team column', () => {
  const dir = mkdtempSync(join(tmpdir(), 'roster-'));
  try {
    const file = join(dir, 'players.db');
    const db = new DatabaseSync(file);
    db.exec(
      "CREATE TABLE known_players (account_id TEXT PRIMARY KEY, name TEXT NOT NULL, mmr INTEGER); INSERT INTO known_players VALUES ('42', 'Kept', 5000);"
    );
    db.close();
    const players = createKnownPlayersStore(file);
    assert.equal(players.warning, undefined);
    assert.deepEqual(players.list(), [{ accountId: '42', name: 'Kept', mmr: 5000, teamId: null }]);
    players.replaceAll([{ accountId: '7', name: 'Linked', mmr: null, teamId: 'team-a' }]);
    assert.equal(players.list()[0]?.teamId, 'team-a');
    players.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
