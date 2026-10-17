export interface LeagueInfo {
  readonly leagueId: number;
  readonly name: string;
}

export interface LeagueMatch {
  readonly matchId: string;
  readonly startTime: number; // Unix seconds
  readonly radiantTeamId: number | null;
  readonly direTeamId: number | null;
  readonly radiantWin: boolean | null;
  readonly heroIds?: number[];
  readonly matchSequence?: string;

  readonly seriesId: number | null;

  readonly seriesType: number | null; // Valve: 0 = Bo1, 1 = Bo3, 2 = Bo5.
}

export interface SeriesGameResult {
  readonly heroIds?: number[];
  readonly matchId: string;
  readonly startTime: number;
  readonly winnerTeamId: number | null;
  readonly radiantTeamId: number | null;
  readonly direTeamId: number | null;
}

export interface ResolvedLeagueSeries {
  readonly seriesId: number | null;

  readonly teamIds: readonly [number, number];
  readonly wins: readonly [number, number];
  readonly bestOf: number | null;
  readonly games: readonly SeriesGameResult[];
}

export interface TournamentSeriesTeam {
  readonly teamId: number;
  readonly name: string;
  readonly wins: number;
}

export interface TournamentSeriesGame {
  readonly matchId: string;
  readonly startTime: number;
  readonly winnerTeamId: number | null;

  readonly heroIds: number[];
}

export interface TournamentSeries {
  readonly seriesId: number | null;
  readonly bestOf: number | null;
  readonly teams: readonly [TournamentSeriesTeam, TournamentSeriesTeam];
  readonly games: readonly TournamentSeriesGame[];

  readonly scoresComplete?: boolean;
}

// The live ticket's league and the Valve history of its series.
export interface TournamentState {
  readonly league: LeagueInfo | null;
  readonly series: TournamentSeries | null;
  readonly message: string | null;
}

export function bestOfFromSeriesType(seriesType: number | null): number | null {
  if (seriesType === 0) {
    return 1;
  }
  if (seriesType === 1) {
    return 3;
  }
  return seriesType === 2 ? 5 : null;
}

function involvesBoth(match: LeagueMatch, teamA: number, teamB: number): boolean {
  const ids = [match.radiantTeamId, match.direTeamId];
  return ids.includes(teamA) && ids.includes(teamB);
}

export interface ResolveSeriesOptions {
  readonly seriesId?: number | null;
  readonly anchorMatchId?: string | null;
  readonly includeAnchor?: boolean;
}

export function resolveCurrentSeries(
  matches: readonly LeagueMatch[],
  teamA: number,
  teamB: number,
  options: ResolveSeriesOptions = {}
): ResolvedLeagueSeries | null {
  const seriesId = options.seriesId;
  if (seriesId === undefined || seriesId === null || seriesId <= 0) {
    return null;
  }
  const group = matches
    .filter((match) => match.seriesId === seriesId && involvesBoth(match, teamA, teamB))
    .sort((a, b) => a.startTime - b.startTime);
  if (group.length === 0) {
    return null;
  }

  const anchorId = options.anchorMatchId ?? null;
  const anchor = group.find((match) => match.matchId === anchorId);
  const games = group.filter((match) => {
    if (match.matchId === anchorId) return options.includeAnchor === true;
    if (anchor !== undefined && match.startTime > anchor.startTime) return false;
    if (anchorId !== null && /^\d+$/.test(anchorId) && /^\d+$/.test(match.matchId)) {
      return BigInt(match.matchId) < BigInt(anchorId);
    }
    return anchor === undefined || match.startTime < anchor.startTime;
  });

  let winsA = 0;
  let winsB = 0;
  const results: SeriesGameResult[] = games.map((match) => {
    let winnerTeamId: number | null = null;
    if (match.radiantWin !== null) {
      winnerTeamId = match.radiantWin ? match.radiantTeamId : match.direTeamId;
    }
    if (winnerTeamId === teamA) {
      winsA += 1;
    } else if (winnerTeamId === teamB) {
      winsB += 1;
    }

    return {
      matchId: match.matchId,
      startTime: match.startTime,
      winnerTeamId,
      heroIds: match.heroIds ?? [],
      radiantTeamId: match.radiantTeamId,
      direTeamId: match.direTeamId
    };
  });

  const seriesType = group.find(
    (match) => bestOfFromSeriesType(match.seriesType) !== null
  )?.seriesType;

  return {
    seriesId: group.find((match) => (match.seriesId ?? 0) > 0)?.seriesId ?? null,
    teamIds: [teamA, teamB],
    wins: [winsA, winsB],
    bestOf: bestOfFromSeriesType(seriesType ?? null),
    games: results
  };
}
