import assert from 'node:assert/strict';
import test from 'node:test';

import type { DotaGsiData, DotaGsiDraft } from '../src/shared/dotaGsiPayload.js';
import {
  getDraftTeamSlots,
  getExpectedBanCount,
  getWinningSide
} from '../src/shared/dotaGsiPayload.js';

const MID_DRAFT: DotaGsiDraft = {
  activeteam: 3,
  pick: true,
  activeteam_time_remaining: 21,
  radiant_bonus_time: 114,
  dire_bonus_time: 76,
  team2: {
    home_team: true,
    pick0_id: 26,
    pick0_class: 'lion',
    pick1_id: 14,
    pick1_class: 'pudge',
    ban0_id: 8,
    ban0_class: 'juggernaut',
    ban1_id: 74,
    ban1_class: 'invoker',
    ban2_id: 1,
    ban2_class: 'antimage'
  },
  team3: {
    home_team: false,
    pick0_id: 5,
    pick0_class: 'crystal_maiden',
    ban0_id: 11,
    ban0_class: 'nevermore',
    ban1_id: 25,
    ban1_class: 'lina'
  }
};

test('getDraftTeamSlots reads numbered pick/ban keys in order into fixed-length arrays', () => {
  const { picks, bans } = getDraftTeamSlots(MID_DRAFT, 'team2');

  assert.equal(picks.length, 5);
  assert.equal(bans.length, 7);
  assert.deepEqual(picks[0], { heroId: 26, heroClass: 'lion' });
  assert.deepEqual(picks[1], { heroId: 14, heroClass: 'pudge' });
  assert.deepEqual(picks[2], { heroId: null, heroClass: null });
  assert.deepEqual(bans[2], { heroId: 1, heroClass: 'antimage' });
  assert.deepEqual(bans[3], { heroId: null, heroClass: null });
});

test('getDraftTeamSlots treats id 0 and empty class as unfilled', () => {
  const draft: DotaGsiDraft = {
    team2: { pick0_id: 0, pick0_class: '', pick1_id: 33, pick1_class: 'enchantress' }
  };
  const { picks } = getDraftTeamSlots(draft, 'team2');

  assert.deepEqual(picks[0], { heroId: null, heroClass: null });
  assert.deepEqual(picks[1], { heroId: 33, heroClass: 'enchantress' });
});

test('getDraftTeamSlots tolerates a missing draft or team block', () => {
  assert.equal(getDraftTeamSlots(undefined, 'team2').picks.length, 5);
  assert.equal(getDraftTeamSlots({}, 'team3').bans.length, 7);
  assert.ok(getDraftTeamSlots({}, 'team3').picks.every((slot) => slot.heroId === null));
});

test('getWinningSide fires only at POST_GAME with a decisive win_team', () => {
  const postGameWin: DotaGsiData = {
    map: { game_state: 'DOTA_GAMERULES_STATE_POST_GAME', win_team: 'dire' }
  };
  assert.equal(getWinningSide(postGameWin), 'dire');

  assert.equal(
    getWinningSide({ map: { game_state: 'DOTA_GAMERULES_STATE_POST_GAME', win_team: 'none' } }),
    null
  );
  assert.equal(
    getWinningSide({
      map: { game_state: 'DOTA_GAMERULES_STATE_GAME_IN_PROGRESS', win_team: 'radiant' }
    }),
    null
  );
  assert.equal(getWinningSide({ map: { game_state: 'DOTA_GAMERULES_STATE_POST_GAME' } }), null);
});

test('getExpectedBanCount collapses to 3 for Captains Draft and stays 7 otherwise', () => {
  assert.equal(getExpectedBanCount({ map: { game_mode: 'DOTA_GAMEMODE_CD' } }), 3);
  assert.equal(getExpectedBanCount({ map: { game_mode: 16 } }), 3);
  assert.equal(getExpectedBanCount({ map: { game_mode: 'DOTA_GAMEMODE_CM' } }), 7);
  assert.equal(getExpectedBanCount({}), 7);
});
