import assert from 'node:assert/strict';
import test from 'node:test';

import type { DotaGsiData } from '../src/shared/gsi.js';
import { getSelectedDotaGsiHero } from '../src/shared/gsi.js';

test('finds the selected unit path while the game is in progress', () => {
  const gsiData: DotaGsiData = {
    hero: {
      team2: {
        player0: {
          name: 'npc_dota_hero_ursa',
          'selected_unit': false
        }
      },
      team3: {
        player7: {
          level: 13,
          name: 'npc_dota_hero_tidehunter',
          'selected_unit': true
        }
      }
    },
    map: {
      'game_state': 'DOTA_GAMERULES_STATE_GAME_IN_PROGRESS'
    },
    player: {
      team3: {
        player7: {
          name: 'Driftwood',
          'team_name': 'dire'
        }
      }
    }
  };

  const selectedHero = getSelectedDotaGsiHero(gsiData);

  assert.equal(selectedHero?.teamKey, 'team3');
  assert.equal(selectedHero?.heroKey, 'player7');
  assert.equal(selectedHero?.hero.name, 'npc_dota_hero_tidehunter');
  assert.equal(selectedHero?.hero.level, 13);
  assert.equal(selectedHero?.player?.name, 'Driftwood');
});

test('ignores selected units before the game is in progress', () => {
  const gsiData: DotaGsiData = {
    hero: {
      team2: {
        player0: {
          name: 'npc_dota_hero_ursa',
          'selected_unit': true
        }
      }
    },
    map: {
      'game_state': 'DOTA_GAMERULES_STATE_PRE_GAME'
    }
  };

  assert.equal(getSelectedDotaGsiHero(gsiData), null);
});
