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

export interface SelectedDotaGsiHero {
  readonly hero: DotaGsiHero;
  readonly heroKey: DotaGsiPlayerKey;
  readonly player: DotaGsiPlayer | null;
  readonly teamKey: DotaGsiTeamKey;
}

const DOTA_GSI_TEAM_KEYS = ['team2', 'team3'] as const;

export function getSelectedDotaGsiHero(gsiData: DotaGsiData): SelectedDotaGsiHero | null {
  if (gsiData.map?.game_state !== 'DOTA_GAMERULES_STATE_GAME_IN_PROGRESS') {
    return null;
  }

  for (const teamKey of DOTA_GSI_TEAM_KEYS) {
    const heroTeam = gsiData.hero?.[teamKey];

    if (heroTeam === undefined) {
      continue;
    }

    for (const [heroKey, hero] of Object.entries(heroTeam)) {
      if (hero?.selected_unit !== true) {
        continue;
      }

      const playerKey = heroKey as DotaGsiPlayerKey;

      return {
        hero,
        heroKey: playerKey,
        player: gsiData.player?.[teamKey]?.[playerKey] ?? null,
        teamKey
      };
    }
  }

  return null;
}
