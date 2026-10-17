import {
  getDotaGsiMatchId,
  getSideAccountIds,
  getWinningSide,
  type DotaGameState,
  type DotaGsiData,
  type DotaGsiLeague
} from './dotaGsiPayload.js';

export interface MatchContext {
  matchId: string | null;
  gameState: DotaGameState | null;
  league: DotaGsiLeague | null;
  leagueId: number | null;
  seriesId: number | null;
  postGame: boolean;
  preGame: boolean;
  winner: 'radiant' | 'dire' | null;
  accounts: { radiant: string[]; dire: string[] };
}

export function positiveId(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : null;
}

const PRE_GAME_STATES: readonly string[] = [
  'DOTA_GAMERULES_STATE_HERO_SELECTION',
  'DOTA_GAMERULES_STATE_STRATEGY_TIME',
  'DOTA_GAMERULES_STATE_TEAM_SHOWCASE',
  'DOTA_GAMERULES_STATE_PRE_GAME'
];

export function readMatchContext(data: DotaGsiData, previous?: MatchContext): MatchContext {
  const hasMap = data.map !== undefined;
  const matchId = hasMap ? getDotaGsiMatchId(data) : (previous?.matchId ?? null);
  const gameState = hasMap ? (data.map?.game_state ?? null) : (previous?.gameState ?? null);
  const sameMatch = matchId === previous?.matchId;
  const league =
    data.league ?? (!hasMap || (sameMatch && matchId !== null) ? (previous?.league ?? null) : null);
  return {
    matchId,
    gameState,
    league,
    leagueId: positiveId(league?.league_id),
    seriesId: positiveId(league?.series_id),
    postGame: gameState === 'DOTA_GAMERULES_STATE_POST_GAME',
    preGame: gameState !== null && PRE_GAME_STATES.includes(gameState),
    winner: getWinningSide(data),
    accounts:
      data.player === undefined && sameMatch && previous
        ? previous.accounts
        : {
            radiant: getSideAccountIds(data, 'team2'),
            dire: getSideAccountIds(data, 'team3')
          }
  };
}
