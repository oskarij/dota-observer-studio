import type { DotaGsiData } from '../../shared/dotaGsiPayload.js';
import type { KnownPlayer } from '../../shared/knownPlayer.js';

export const SAMPLE_GSI_DATA: DotaGsiData = {
  map: { game_state: 'DOTA_GAMERULES_STATE_GAME_IN_PROGRESS' },
  hero: {
    team2: {
      player0: {
        id: 70,
        name: 'npc_dota_hero_ursa',
        level: 13,
        alive: true,
        health: 933,
        max_health: 2120,
        health_percent: 44,
        mana: 377,
        max_mana: 1255,
        mana_percent: 30,
        selected_unit: false
      },
      player1: {
        id: 107,
        name: 'npc_dota_hero_earth_spirit',
        level: 13,
        alive: true,
        health: 2120,
        max_health: 2120,
        health_percent: 100,
        mana: 778,
        max_mana: 1255,
        mana_percent: 62,
        selected_unit: false
      },
      player2: {
        id: 135,
        name: 'npc_dota_hero_dawnbreaker',
        level: 11,
        alive: true,
        health: 1861,
        max_health: 1880,
        health_percent: 99,
        mana: 884,
        max_mana: 1105,
        mana_percent: 80,
        selected_unit: false
      },
      player3: {
        id: 100,
        name: 'npc_dota_hero_tusk',
        level: 9,
        alive: true,
        health: 1640,
        max_health: 1640,
        health_percent: 100,
        mana: 430,
        max_mana: 955,
        mana_percent: 45,
        selected_unit: false
      },
      player4: {
        id: 110,
        name: 'npc_dota_hero_phoenix',
        level: 9,
        alive: true,
        health: 1640,
        max_health: 1640,
        health_percent: 100,
        mana: 860,
        max_mana: 955,
        mana_percent: 90,
        selected_unit: false
      }
    },
    team3: {
      player5: {
        id: 6,
        name: 'npc_dota_hero_drow_ranger',
        level: 14,
        alive: true,
        health: 1994,
        max_health: 2240,
        health_percent: 89,
        mana: 732,
        max_mana: 1330,
        mana_percent: 55,
        selected_unit: false
      },
      player6: {
        id: 16,
        name: 'npc_dota_hero_sand_king',
        level: 14,
        alive: true,
        health: 1658,
        max_health: 2240,
        health_percent: 74,
        mana: 532,
        max_mana: 1330,
        mana_percent: 40,
        selected_unit: false
      },
      player7: {
        id: 29,
        name: 'npc_dota_hero_tidehunter',
        level: 13,
        alive: true,
        health: 2120,
        max_health: 2120,
        health_percent: 100,
        mana: 879,
        max_mana: 1255,
        mana_percent: 70,
        selected_unit: true
      },
      player8: {
        id: 30,
        name: 'npc_dota_hero_witch_doctor',
        level: 10,
        alive: true,
        health: 1355,
        max_health: 1760,
        health_percent: 77,
        mana: 340,
        max_mana: 1030,
        mana_percent: 33,
        selected_unit: false
      },
      player9: {
        id: 83,
        name: 'npc_dota_hero_treant',
        level: 10,
        alive: true,
        health: 1760,
        max_health: 1760,
        health_percent: 100,
        mana: 906,
        max_mana: 1030,
        mana_percent: 88,
        selected_unit: false
      }
    }
  },
  player: {
    team2: {
      player0: { accountid: '900000001', name: 'Voidwalker', team_name: 'radiant' },
      player1: { accountid: '900000002', name: 'mossy', team_name: 'radiant' },
      player2: { accountid: '900000003', name: 'Sunder', team_name: 'radiant' },
      player3: { accountid: '900000004', name: 'frost.', team_name: 'radiant' },
      player4: { accountid: '900000005', name: 'ZephyrQQ', team_name: 'radiant' }
    },
    team3: {
      player5: { accountid: '900000006', name: 'Quill', team_name: 'dire' },
      player6: { accountid: '900000007', name: 'desertking', team_name: 'dire' },
      player7: { accountid: '900000008', name: 'MarkoDota', team_name: 'dire' },
      player8: { accountid: '900000009', name: 'wd_main', team_name: 'dire' },
      player9: { accountid: '900000010', name: 'Grove', team_name: 'dire' }
    }
  }
};

export const SAMPLE_KNOWN_PLAYERS: readonly KnownPlayer[] = [
  { accountId: '900000008', name: 'MarkoDota', mmr: 5200 }
];
