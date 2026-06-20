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
export type DotaGsiPlayerKey = `player${number}`;

export interface DotaGsiData {
  readonly hero?: Partial<Record<DotaGsiTeamKey, DotaGsiHeroTeam>>;
  readonly map?: DotaGsiMap;
  readonly player?: Partial<Record<DotaGsiTeamKey, DotaGsiPlayerTeam>>;
}

export interface DotaGsiMap {
  readonly game_state?: DotaGameState;
  // The spectated match's id. Present whenever a match is assigned; '0' (or absent) before then.
  readonly matchid?: string;
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

// The spectated match id, or null before a match is assigned. GSI sends '0' in menus/between games.
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
