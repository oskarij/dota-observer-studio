import assert from 'node:assert/strict';
import test from 'node:test';
import { createValidatedSettings } from '../src/persistence/validatedSettings.js';
import { createTeamsStore } from '../src/persistence/teamsStore.js';
import { createKnownPlayersStore } from '../src/persistence/knownPlayersStore.js';
import { createRosterService } from '../src/runtime/rosterService.js';
import { createDefaultOverlayConfig } from '../src/shared/componentSettings.js';

test('invalid imports never replace the last valid saved settings', () => {
  let disk: unknown = createDefaultOverlayConfig();
  const store = createValidatedSettings({
    read: () => disk,
    write: (next) => {
      disk = structuredClone(next);
    },
    recover() {
      assert.fail('valid initial settings');
    }
  });
  const before = store.get();
  for (const invalid of [
    null,
    [],
    { enabled: {}, settings: { 'draft-board': null }, options: {} },
    { enabled: { 'draft-board': 'yes' }, settings: {}, options: {} },
    { enabled: {}, settings: { 'draft-board': { position: { x: Infinity } } }, options: {} },
    { enabled: {}, settings: {}, options: { 'draft-board': { showDuringStrategyTime: 'yes' } } },
    { enabled: {}, settings: {}, options: { 'selected-player': { maxWidth: 30 } } },
    { enabled: {}, settings: {}, options: { unknown: {} } },
    { enabled: {}, settings: { 'draft-board': { constructor: null } }, options: {} }
  ]) {
    assert.throws(() => store.set(invalid));
    assert.deepEqual(store.get(), before);
    assert.deepEqual(disk, before);
  }
});

test('invalid persisted settings are archived and startup recovers a usable configuration', () => {
  const invalid = { enabled: {}, settings: { 'draft-board': null }, options: {} };
  let archived: unknown = null;
  let disk: unknown = invalid;
  const store = createValidatedSettings({
    read: () => disk,
    write: (next) => {
      disk = next;
    },
    recover: (value) => {
      archived = value;
    }
  });
  assert.deepEqual(archived, invalid);
  assert.deepEqual(store.get(), createDefaultOverlayConfig());
  const reopened = createValidatedSettings({
    read: () => disk,
    write: (next) => {
      disk = next;
    },
    recover() {
      assert.fail('recovery must persist');
    }
  });
  assert.deepEqual(reopened.get(), store.get());
});

test('a disk write failure keeps the last confirmed configuration', () => {
  let fail = false;
  const store = createValidatedSettings({
    read: createDefaultOverlayConfig,
    write() {
      if (fail) throw new Error('Disk full');
    },
    recover() {}
  });
  const before = store.get();
  const next = store.get();
  next.enabled['draft-board'] = true;
  fail = true;
  assert.throws(() => store.set(next), /Disk full/);
  assert.deepEqual(store.get(), before);
});

test('editing a stale team preserves detected teams and their new Valve IDs', () => {
  const teams = createTeamsStore(':memory:');
  const players = createKnownPlayersStore(':memory:');
  let notifications = 0;
  const roster = createRosterService({
    teams,
    players,
    isTeamAssigned: () => false,
    onTeamsChanged: () => {
      notifications++;
    },
    onPlayersChanged() {}
  });
  try {
    teams.upsert({ id: 'saved', name: 'Saved', tag: '', logoPath: null, externalTeamId: null });
    const existing = teams.list()[0];
    assert.ok(existing);
    teams.upsert({ ...existing, externalTeamId: 500 });
    teams.upsert({
      id: 'detected',
      name: 'Detected',
      tag: '',
      logoPath: null,
      externalTeamId: 501
    });
    assert.equal(roster.updateTeam(existing.id, { tag: 'EDIT' }).ok, true);
    assert.equal(teams.list().find((team) => team.id === existing.id)?.externalTeamId, 500);
    assert.ok(teams.list().some((team) => team.id === 'detected'));
    assert.equal(notifications, 1);
    assert.equal(roster.updateTeam(existing.id, { ...existing }).ok, false);
  } finally {
    teams.close();
    players.close();
  }
});

test('roster validation rejects duplicate accounts, orphan links and failed writes before publishing', () => {
  const teams = createTeamsStore(':memory:');
  const players = createKnownPlayersStore(':memory:');
  let fail = false;
  let notifications = 0;
  const roster = createRosterService({
    teams,
    players: {
      ...players,
      replaceAll(next) {
        if (fail) throw new Error('Disk full');
        players.replaceAll(next);
      }
    },
    isTeamAssigned: () => false,
    onTeamsChanged() {},
    onPlayersChanged: () => {
      notifications++;
    }
  });
  try {
    players.replaceAll([{ accountId: '1', name: 'Player', mmr: null, teamId: null }]);
    const before = players.list();
    const first = before[0];
    assert.ok(first);
    assert.equal(roster.replacePlayers([first, first]).ok, false);
    assert.equal(roster.updatePlayer(first.accountId, { teamId: 'unknown-team' }).ok, false);
    fail = true;
    assert.deepEqual(roster.updatePlayer(first.accountId, { name: 'Changed' }), {
      ok: false,
      reason: 'Disk full'
    });
    assert.equal(notifications, 0);
    assert.deepEqual(players.list(), before);
  } finally {
    teams.close();
    players.close();
  }
});
