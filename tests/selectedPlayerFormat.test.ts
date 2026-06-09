import assert from 'node:assert/strict';
import test from 'node:test';

import {
  formatMedalName,
  formatMmr
} from '../src/overlay/elements/selectedPlayer/selectedPlayerFormat.js';

test('formats mmr for display', () => {
  assert.equal(formatMmr(null), '--');
  assert.equal(formatMmr(950), '950');
  assert.equal(formatMmr(5000), '5k');
  assert.equal(formatMmr(5300), '5.3k');
  assert.equal(formatMmr(11500), '11.5k');
});

test('capitalizes medal names', () => {
  assert.equal(formatMedalName('immortal'), 'Immortal');
  assert.equal(formatMedalName('divine'), 'Divine');
});
