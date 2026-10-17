export type DotaGameState =
  | 'DOTA_GAMERULES_STATE_INIT'
  | 'DOTA_GAMERULES_STATE_WAIT_FOR_PLAYERS_TO_LOAD'
  | 'DOTA_GAMERULES_STATE_HERO_SELECTION'
  | 'DOTA_GAMERULES_STATE_STRATEGY_TIME'
  | 'DOTA_GAMERULES_STATE_TEAM_SHOWCASE'
  | 'DOTA_GAMERULES_STATE_PRE_GAME'
  | 'DOTA_GAMERULES_STATE_GAME_IN_PROGRESS'
  | 'DOTA_GAMERULES_STATE_POST_GAME';

export type DotaGsiTeamKey = 'team2' | 'team3';
export const DRAFT_GAME_STATES: readonly DotaGameState[] = [
  'DOTA_GAMERULES_STATE_HERO_SELECTION',
  'DOTA_GAMERULES_STATE_STRATEGY_TIME',
  'DOTA_GAMERULES_STATE_TEAM_SHOWCASE'
];
export type DotaGsiPlayerKey = `player${number}`;

export interface DotaGsiData {
  readonly draft?: DotaGsiDraft;
  readonly hero?: Partial<Record<DotaGsiTeamKey, DotaGsiHeroTeam>>;
  readonly league?: DotaGsiLeague;
  readonly map?: DotaGsiMap;
  readonly player?: Partial<Record<DotaGsiTeamKey, DotaGsiPlayerTeam>>;
}

export interface DotaGsiMap {
  readonly game_state?: DotaGameState;
  // e.g. 'DOTA_GAMEMODE_CM'; observed as a string but kept loose in case Dota sends the enum number.
  readonly game_mode?: string | number;
  // '0' or absent before a match is assigned.
  readonly matchid?: string;
  // The draft timers freeze while true.
  readonly paused?: boolean;
  // 'radiant' or 'dire' at POST_GAME, 'none' before. Treat any other value as undecided.
  readonly win_team?: string;
}

// The pick/ban block sent while spectating a captains-style draft (cfg "draft" flag). Slots are
// flat numbered keys (pick0_id, pick0_class, ban0_id, ...) rather than arrays.
export interface DotaGsiDraft {
  readonly activeteam?: number; // 2 = radiant, 3 = dire
  readonly pick?: boolean; // true when the active phase is a pick (vs a ban)
  readonly activeteam_time_remaining?: number; // seconds
  readonly radiant_bonus_time?: number; // reserve time, seconds
  readonly dire_bonus_time?: number;
  readonly team2?: DotaGsiDraftTeam;
  readonly team3?: DotaGsiDraftTeam;
}

export interface DotaGsiDraftTeam {
  readonly home_team?: boolean;
  readonly [slotId: `${'pick' | 'ban'}${number}_id`]: number | undefined;
  readonly [slotClass: `${'pick' | 'ban'}${number}_class`]: string | undefined;
}

// Sent when the lobby has a league ticket. Shape captured from a real payload; everything stays
// optional because Valve gives no guarantees.
export interface DotaGsiLeague {
  readonly league_id?: number;
  readonly name?: string;
  readonly tier?: number;
  readonly region?: number;
  readonly series_id?: number;
  readonly match_id?: string;
  readonly start_time?: number;
  readonly team_id_1?: number;
  readonly team_id_2?: number;
  readonly radiant?: DotaGsiLeagueTeam;
  readonly dire?: DotaGsiLeagueTeam;
}

export interface DotaGsiLeagueTeam {
  readonly team_id?: number;
  readonly team_tag?: string;
  readonly name?: string;
  readonly series_wins?: number;
}

export type DotaGsiHeroTeam = Partial<Record<DotaGsiPlayerKey, DotaGsiHero>>;
export type DotaGsiPlayerTeam = Partial<Record<DotaGsiPlayerKey, DotaGsiPlayer>>;

export interface DotaGsiHero {
  readonly alive?: boolean;
  readonly health?: number;
  readonly health_percent?: number;
  readonly id?: number;
  readonly level?: number;
  readonly mana?: number;
  readonly mana_percent?: number;
  readonly max_health?: number;
  readonly max_mana?: number;
  readonly name?: string;
  readonly selected_unit?: boolean;
}

export interface DotaGsiPlayer {
  readonly accountid?: string;
  readonly name?: string;
  readonly team_name?: 'radiant' | 'dire' | string;
}

export interface SelectedDotaGsiPlayer {
  readonly hero: DotaGsiHero;
  readonly player: DotaGsiPlayer | null;
  readonly playerKey: DotaGsiPlayerKey;
  readonly teamKey: DotaGsiTeamKey;
}

const DOTA_GSI_TEAM_KEYS = ['team2', 'team3'] as const;

export function getSelectedDotaGsiPlayer(gsiData: DotaGsiData): SelectedDotaGsiPlayer | null {
  if (gsiData.map?.game_state !== 'DOTA_GAMERULES_STATE_GAME_IN_PROGRESS') {
    return null;
  }

  for (const teamKey of DOTA_GSI_TEAM_KEYS) {
    const heroTeam = gsiData.hero?.[teamKey];

    if (heroTeam === undefined) {
      continue;
    }

    for (const [playerKey, hero] of Object.entries(heroTeam)) {
      if (hero?.selected_unit !== true) {
        continue;
      }

      const typedPlayerKey = playerKey as DotaGsiPlayerKey;

      return {
        hero,
        player: gsiData.player?.[teamKey]?.[typedPlayerKey] ?? null,
        playerKey: typedPlayerKey,
        teamKey
      };
    }
  }

  return null;
}

// null before a match is assigned (GSI sends '0' in menus and between games).
export function getDotaGsiMatchId(gsiData: DotaGsiData): string | null {
  const matchId = gsiData.map?.matchid;

  if (matchId === undefined || matchId === '' || matchId === '0') {
    return null;
  }

  return matchId;
}

// Every picked hero id across both teams (the fearless ban set for a captured game). Empty/locked
// slots report id 0, so they're skipped; the caller checks for a full 10-hero lineup.
export function getPickedHeroIds(gsiData: DotaGsiData): number[] {
  return getPickedHeroes(gsiData).map((entry) => entry.heroId);
}

// Account ids on one side, so linked known players can identify which saved team is playing it.
export function getSideAccountIds(gsiData: DotaGsiData, teamKey: DotaGsiTeamKey): string[] {
  const accountIds: string[] = [];

  for (const player of Object.values(gsiData.player?.[teamKey] ?? {})) {
    if (player?.accountid !== undefined) {
      accountIds.push(player.accountid);
    }
  }

  return accountIds;
}

// Every account id in the spectated game, recorded with a captured game so it can be recognised
// later as belonging to a series.
export function getGameAccountIds(gsiData: DotaGsiData): string[] {
  return DOTA_GSI_TEAM_KEYS.flatMap((teamKey) => getSideAccountIds(gsiData, teamKey));
}

// Captains Mode slot counts; Captains Draft (5/3) fits inside these, trailing slots just stay empty.
const CM_PICKS_PER_TEAM = 5;
const CM_BANS_PER_TEAM = 7;
const CD_BANS_PER_TEAM = 3;

const CD_MODES: readonly (string | number)[] = ['DOTA_GAMEMODE_CD', 16];

export interface DraftSlot {
  readonly heroId: number | null;
  readonly heroClass: string | null;
}

export interface DraftTeamSlots {
  readonly picks: DraftSlot[];
  readonly bans: DraftSlot[];
}

// Fixed-length pick/ban slot arrays for one side, read from the numbered draft keys in order.
// Unfilled slots are { heroId: null, heroClass: null } so renderers can keep stable slot nodes.
export function getDraftTeamSlots(
  draft: DotaGsiDraft | undefined,
  teamKey: DotaGsiTeamKey
): DraftTeamSlots {
  const team = draft?.[teamKey];

  return {
    picks: readDraftSlots(team, 'pick', CM_PICKS_PER_TEAM),
    bans: readDraftSlots(team, 'ban', CM_BANS_PER_TEAM)
  };
}

function readDraftSlots(
  team: DotaGsiDraftTeam | undefined,
  prefix: 'pick' | 'ban',
  count: number
): DraftSlot[] {
  const slots: DraftSlot[] = [];

  for (let index = 0; index < count; index += 1) {
    const id = team?.[`${prefix}${index}_id`];
    const heroClass = team?.[`${prefix}${index}_class`];

    slots.push({
      heroId: typeof id === 'number' && id > 0 ? id : null,
      heroClass: typeof heroClass === 'string' && heroClass !== '' ? heroClass : null
    });
  }

  return slots;
}

// The side that won the spectated game, only once the game has actually ended.
export function getWinningSide(gsiData: DotaGsiData): 'radiant' | 'dire' | null {
  if (gsiData.map?.game_state !== 'DOTA_GAMERULES_STATE_POST_GAME') {
    return null;
  }

  const winTeam = gsiData.map.win_team;
  return winTeam === 'radiant' || winTeam === 'dire' ? winTeam : null;
}

// Ban slots the current mode can actually fill, so renderers can collapse the unused tail up front
// (Captains Draft uses 3 of the 7 CM slots) instead of guessing from which slots stay empty.
export function getExpectedBanCount(gsiData: DotaGsiData): number {
  const gameMode = gsiData.map?.game_mode;
  return gameMode !== undefined && CD_MODES.includes(gameMode)
    ? CD_BANS_PER_TEAM
    : CM_BANS_PER_TEAM;
}

// Picked heroes paired with the in-game player name in the matching slot (null when the player block
// is absent), so a captured game can be labelled by who played what.
export function getPickedHeroes(
  gsiData: DotaGsiData
): { heroId: number; playerName: string | null }[] {
  const picked: { heroId: number; playerName: string | null }[] = [];

  for (const teamKey of DOTA_GSI_TEAM_KEYS) {
    const heroTeam = gsiData.hero?.[teamKey];

    if (heroTeam === undefined) {
      continue;
    }

    for (const [playerKey, hero] of Object.entries(heroTeam)) {
      if (typeof hero?.id === 'number' && hero.id > 0) {
        const playerName = gsiData.player?.[teamKey]?.[playerKey as DotaGsiPlayerKey]?.name ?? null;
        picked.push({ heroId: hero.id, playerName });
      }
    }
  }

  return picked;
}
