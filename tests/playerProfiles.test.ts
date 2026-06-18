import assert from 'node:assert/strict';
import test from 'node:test';

import { mmrToMedal } from '../src/overlay/elements/selectedPlayer/playerProfileData.js';

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
