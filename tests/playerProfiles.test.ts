import assert from 'node:assert/strict';
import test from 'node:test';

import {
  mmrToMedal,
  parsePlayerProfilesYaml
} from '../src/overlay/elements/selectedPlayer/playerProfileData.js';

test('parses player profiles keyed by account id', () => {
  const profiles = parsePlayerProfilesYaml(`
900000101:
  name: Nova
  mmr: 11500

900000102:
  name: Ember
  mmr: 7400
`);

  assert.deepEqual(profiles, [
    {
      accountId: '900000101',
      mmr: 11500,
      name: 'Nova'
    },
    {
      accountId: '900000102',
      mmr: 7400,
      name: 'Ember'
    }
  ]);
});

test('maps mmr to rank medals', () => {
  assert.equal(mmrToMedal(null), null);
  assert.equal(mmrToMedal(5620), 'immortal');
  assert.equal(mmrToMedal(4260), 'divine');
  assert.equal(mmrToMedal(3850), 'ancient');
  assert.equal(mmrToMedal(3080), 'legend');
  assert.equal(mmrToMedal(2310), 'archon');
  assert.equal(mmrToMedal(1540), 'crusader');
  assert.equal(mmrToMedal(770), 'guardian');
  assert.equal(mmrToMedal(0), 'herald');
});
