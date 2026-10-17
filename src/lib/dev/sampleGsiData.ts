import { asset } from '$app/paths';

import type { DotaGsiData } from '../../shared/dotaGsiPayload.js';
import type { KnownPlayer } from '../../shared/knownPlayer.js';
import type { SeriesStatePayload } from '../../shared/seriesState.js';

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
  { accountId: '900000002', name: 'Moss', mmr: null, teamId: null },
  { accountId: '900000007', name: 'Desert King', mmr: null, teamId: null },
  { accountId: '900000008', name: 'MarkoDota', mmr: 5200, teamId: null }
];

// Draft-phase snapshot for previewing the draft-phase overlays: a mid-draft Captains Mode pick/ban
// block for the draft board (Dire actively picking with ~21s left), plus the game_state the
// fearless-draft grid keys on (its ban pool comes from SAMPLE_BANNED_HERO_IDS).
export const SAMPLE_DRAFT_GSI_DATA: DotaGsiData = {
  player: SAMPLE_GSI_DATA.player ?? {},
  map: {
    game_state: 'DOTA_GAMERULES_STATE_HERO_SELECTION',
    game_mode: 'DOTA_GAMEMODE_CM',
    matchid: '0'
  },
  draft: {
    activeteam: 3,
    pick: true,
    activeteam_time_remaining: 21,
    radiant_bonus_time: 114,
    dire_bonus_time: 76,
    team2: {
      home_team: true,
      pick0_id: 100,
      pick0_class: 'tusk',
      pick1_id: 26,
      pick1_class: 'lion',
      pick2_id: 135,
      pick2_class: 'dawnbreaker',
      ban0_id: 74,
      ban0_class: 'invoker',
      ban1_id: 8,
      ban1_class: 'juggernaut',
      ban2_id: 86,
      ban2_class: 'rubick',
      ban3_id: 114,
      ban3_class: 'monkey_king'
    },
    team3: {
      home_team: false,
      pick0_id: 6,
      pick0_class: 'drow_ranger',
      pick1_id: 16,
      pick1_class: 'sand_king',
      ban0_id: 1,
      ban0_class: 'antimage',
      ban1_id: 11,
      ban1_class: 'nevermore',
      ban2_id: 25,
      ban2_class: 'lina'
    }
  }
};

// Stand-in series state so the team-name/logo/score elements render in Sample mode. The bundled
// placeholder logos keep the logo elements visible before the user has configured any real teams.
export const SAMPLE_SERIES_STATE: SeriesStatePayload = {
  radiant: {
    name: 'Taneli Esports',
    logoPath: asset('/sample-team-logo-radiant.svg'),
    score: 1
  },
  dire: {
    name: 'Windo Esports',
    logoPath: asset('/sample-team-logo-dire.svg'),
    score: 0
  },
  seriesConfigured: true
};

// A stand-in fearless ban pool (~16 heroes, as if two prior games of a series were played) so the
// draft grid has something to render while the operator authors its position/size.
export const SAMPLE_BANNED_HERO_IDS: readonly number[] = [
  1, 8, 11, 14, 19, 22, 25, 31, 35, 41, 44, 47, 53, 74, 86, 114
];
