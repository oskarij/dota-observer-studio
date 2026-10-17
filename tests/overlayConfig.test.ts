import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CUSTOM_CSS_MAX_LENGTH,
  createDefaultComponentSettings,
  mergeOverlayConfigDefaults
} from '../src/shared/componentSettings.js';
import { PLAYER_NAMES_ELEMENTS } from '../src/shared/overlayElementCatalog.js';

test('loading a config from before player names supplies settings and options for both tabs', () => {
  const saved = {
    enabled: { 'draft-board': true },
    settings: {
      'draft-board': {
        ...createDefaultComponentSettings('draft-board'),
        position: { x: 900, y: 600 },
        size: 85
      }
    },
    options: { 'draft-board': { showDuringStrategyTime: false } }
  };
  const merged = mergeOverlayConfigDefaults(saved);

  for (const element of PLAYER_NAMES_ELEMENTS) {
    assert.deepEqual(merged.settings[element.id], createDefaultComponentSettings(element.id));
    assert.deepEqual(merged.options[element.id], { nameSource: 'profile', maxWidth: 400 });
    assert.equal(merged.enabled[element.id], true);
  }
  assert.deepEqual(merged.settings['draft-board'], saved.settings['draft-board']);
  assert.deepEqual(merged.options['draft-board'], saved.options['draft-board']);
  assert.equal(merged.enabled['draft-board'], true);
});

test('saved player-name edits survive a load or discard while missing option fields are filled', () => {
  const saved = {
    enabled: { 'player-names-radiant-draft': false, 'player-names-dire-draft': true },
    settings: {
      'player-names-dire-draft': {
        ...createDefaultComponentSettings('player-names-dire-draft'),
        position: { x: 1500, y: 75 },
        size: 120
      }
    },
    options: { 'player-names-dire-draft': { maxWidth: 300 } }
  };
  const merged = mergeOverlayConfigDefaults(saved);

  assert.deepEqual(
    merged.settings['player-names-dire-draft'],
    saved.settings['player-names-dire-draft']
  );
  assert.deepEqual(merged.options['player-names-dire-draft'], {
    nameSource: 'profile',
    maxWidth: 300
  });
  assert.equal(merged.enabled['player-names-dire-draft'], true);
  assert.equal(merged.enabled['player-names-radiant-draft'], false);
  assert.deepEqual(mergeOverlayConfigDefaults(merged), merged);
});

test('legacy positions keep their top-left anchor and missing nested settings receive defaults', () => {
  const saved = JSON.parse(`{
    "enabled": {},
    "settings": {
      "team-name-dire-draft": {
        "position": { "x": 1000, "y": 500 },
        "font": { "family": "Arial" }
      }
    }
  }`) as unknown;
  const merged = mergeOverlayConfigDefaults(saved);
  const setting = merged.settings['team-name-dire-draft'];

  assert.deepEqual(setting?.position, { x: 1000, y: 500 });
  assert.deepEqual(setting?.anchor, { x: 'left', y: 'top' });
  assert.deepEqual(setting?.font, { family: 'Arial', weight: 600, italic: false });
  const colourOnly = mergeOverlayConfigDefaults({
    enabled: {},
    settings: { 'selected-player': { color: '#ffffff' } }
  }).settings['selected-player'];
  assert.deepEqual(colourOnly?.anchor, createDefaultComponentSettings('selected-player').anchor);
  assert.deepEqual(merged.options['player-names-dire-draft'], {
    nameSource: 'profile',
    maxWidth: 400
  });
});

test('editing the merged working copy does not mutate the saved config or the other side', () => {
  const saved = {
    enabled: { 'player-names-radiant-draft': true },
    settings: {
      'player-names-radiant-draft': createDefaultComponentSettings('player-names-radiant-draft')
    },
    options: { 'player-names-radiant-draft': { nameSource: 'ingame', maxWidth: 320 } }
  };
  const snapshot = structuredClone(saved);
  const merged = mergeOverlayConfigDefaults(saved);
  const radiant = merged.settings['player-names-radiant-draft'];
  assert.ok(radiant);
  radiant.position.x = 500;
  radiant.font.family = 'Arial';
  radiant.anchor.x = 'center';
  radiant.shadow.blur = 10;
  merged.options['player-names-radiant-draft'] = { nameSource: 'profile', maxWidth: 900 };

  assert.deepEqual(saved, snapshot);
  assert.deepEqual(
    merged.settings['player-names-dire-draft'],
    createDefaultComponentSettings('player-names-dire-draft')
  );
  assert.deepEqual(merged.options['player-names-dire-draft'], {
    nameSource: 'profile',
    maxWidth: 400
  });
});

test('custom CSS survives a round trip and is capped at the trust boundary', () => {
  const css = '.draft-board { --db-accent: #ffab53; }';
  const base = { enabled: {}, settings: {} };
  assert.equal(mergeOverlayConfigDefaults(base).customCss, '');
  assert.equal(mergeOverlayConfigDefaults({ ...base, customCss: css }).customCss, css);
  assert.throws(() => mergeOverlayConfigDefaults({ ...base, customCss: 42 }));
  assert.throws(() =>
    mergeOverlayConfigDefaults({ ...base, customCss: 'a'.repeat(CUSTOM_CSS_MAX_LENGTH + 1) })
  );
});
