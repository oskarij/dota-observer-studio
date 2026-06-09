import assert from 'node:assert/strict';
import test from 'node:test';

import type { DotaGsiData } from '../src/shared/dotaGsiPayload.js';
import { getSelectedDotaGsiPlayer } from '../src/shared/dotaGsiPayload.js';

test('finds the selected player path while the game is in progress', () => {
  const gsiData: DotaGsiData = {
    hero: {
      team2: {
        player0: {
          name: 'npc_dota_hero_ursa',
          selected_unit: false
        }
      },
      team3: {
        player7: {
          level: 13,
          name: 'npc_dota_hero_tidehunter',
          selected_unit: true
        }
      }
    },
    map: {
      game_state: 'DOTA_GAMERULES_STATE_GAME_IN_PROGRESS'
    },
    player: {
      team3: {
        player7: {
          name: 'Driftwood',
          team_name: 'dire'
        }
      }
    }
  };

  const selectedPlayer = getSelectedDotaGsiPlayer(gsiData);

  assert.equal(selectedPlayer?.teamKey, 'team3');
  assert.equal(selectedPlayer?.playerKey, 'player7');
  assert.equal(selectedPlayer?.hero.name, 'npc_dota_hero_tidehunter');
  assert.equal(selectedPlayer?.hero.level, 13);
  assert.equal(selectedPlayer?.player?.name, 'Driftwood');
});

test('ignores selected players before the game is in progress', () => {
  const gsiData: DotaGsiData = {
    hero: {
      team2: {
        player0: {
          name: 'npc_dota_hero_ursa',
          selected_unit: true
        }
      }
    },
    map: {
      game_state: 'DOTA_GAMERULES_STATE_PRE_GAME'
    }
  };

  assert.equal(getSelectedDotaGsiPlayer(gsiData), null);
});
