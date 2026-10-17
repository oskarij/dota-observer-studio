import {
  resolveCurrentSeries,
  type LeagueMatch,
  type TournamentSeries,
  type TournamentState
} from '../shared/leagueSeries.js';
import { positiveId, type MatchContext } from '../shared/matchContext.js';
import type { Result } from '../shared/result.js';
import { validWins } from '../shared/seriesState.js';
import { NO_KEY_REASON, type ValveClient } from './valveClient.js';

export interface PersistedTournament {
  matches: LeagueMatch[];
}

export interface TournamentServiceConfig {
  store: { get(): Partial<PersistedTournament>; set(tournament: PersistedTournament): void };
  fetchLeagueMatches: ValveClient['fetchLeagueMatches'];
  cachedHeroIds(matchId: string): number[] | null;
  onSeriesChanged(series: TournamentSeries | null): void;
  notifyChanged(): void;
  schedule?: (run: () => void, delayMs: number) => () => void;
}

// The live ticket's series, which Valve history can fill in with its earlier games.
interface Target {
  leagueId: number;
  seriesId: number;
  matchId: string;
  postGame: boolean;
  teams: [{ teamId: number; name: string }, { teamId: number; name: string }];
  ticketWins: [number, number] | null;
}

const UNAVAILABLE = 'Match history is unavailable right now. Keeping saved data and retrying.';
const PENDING = 'Some earlier game data is still pending. Keeping saved data and retrying.';
// shortcut: keeps the newest 500 matches across leagues; enough for a season of one league.
const MATCH_CACHE_CAP = 500;

export type TournamentService = ReturnType<typeof createTournamentService>;

export function createTournamentService(config: TournamentServiceConfig) {
  const schedule =
    config.schedule ??
    ((run, delayMs) => {
      const timer = setTimeout(run, delayMs);
      return () => clearTimeout(timer);
    });
  let matches = config.store.get().matches ?? [];
  let league: TournamentState['league'] = null;
  let target: Target | null = null;
  let targetKey: string | null = null;
  let series: TournamentSeries | null = null;
  let seriesKey: string | null = null;
  let message: string | null = null;
  // Bumped whenever the target changes, so a response for an older target is never applied.
  let generation = 0;
  let loading: Promise<Result> | null = null;
  let cancelRetry: (() => void) | null = null;
  let retryAttempt = 0;
  let disposed = false;

  // Deduplicated only once applied, so a consumer that failed receives the same series again.
  function setSeries(next: TournamentSeries | null): void {
    const key = JSON.stringify(next);
    if (key === seriesKey) return;
    series = next;
    config.onSeriesChanged(next);
    seriesKey = key;
  }

  function resolve(current: Target): TournamentSeries | null {
    const [radiant, dire] = current.teams;
    const resolved = resolveCurrentSeries(matches, radiant.teamId, dire.teamId, {
      seriesId: current.seriesId,
      anchorMatchId: current.matchId,
      includeAnchor: current.postGame
    });
    if (resolved === null) return null;
    const games = resolved.games.map((game) => ({
      matchId: game.matchId,
      startTime: game.startTime,
      winnerTeamId: game.winnerTeamId,
      heroIds:
        game.heroIds?.length === 10 ? game.heroIds : (config.cachedHeroIds(game.matchId) ?? [])
    }));
    const wins = current.ticketWins ?? resolved.wins;
    return {
      seriesId: resolved.seriesId,
      bestOf: resolved.bestOf,
      teams: [
        { ...radiant, wins: wins[0] },
        { ...dire, wins: wins[1] }
      ],
      scoresComplete:
        current.ticketWins !== null || games.every((game) => game.winnerTeamId !== null),
      games
    };
  }

  function remember(fetched: readonly LeagueMatch[]): void {
    const merged = new Map(matches.map((match) => [match.matchId, match]));
    for (const match of fetched) {
      const old = merged.get(match.matchId);
      merged.set(match.matchId, {
        ...match,
        radiantWin: match.radiantWin ?? old?.radiantWin ?? null,
        heroIds:
          match.heroIds?.length === 10 ? match.heroIds : (old?.heroIds ?? match.heroIds ?? [])
      });
    }
    matches = [...merged.values()]
      .sort((a, b) => b.startTime - a.startTime)
      .slice(0, MATCH_CACHE_CAP);
    config.store.set({ matches });
  }

  function retry(): void {
    cancelRetry?.();
    const selected = generation;
    cancelRetry = schedule(
      () => {
        cancelRetry = null;
        if (!disposed && selected === generation) void load();
      },
      Math.min(120_000, 30_000 * 2 ** retryAttempt++)
    );
  }

  function load(): Promise<Result> {
    const current = target;
    if (current === null || disposed) return Promise.resolve({ ok: true });
    if (loading !== null) return loading;
    const selected = generation;
    const [radiantWins, direWins] = current.ticketWins ?? [0, 0];
    const expectedGames = radiantWins + direWins + (current.postGame ? 1 : 0);
    const work = (async (): Promise<Result> => {
      try {
        const result = await config.fetchLeagueMatches(current.leagueId, {
          seriesId: current.seriesId,
          includeResults: current.ticketWins === null,
          excludeMatchId: current.postGame ? null : current.matchId,
          ...(current.ticketWins === null ? {} : { expectedGames })
        });
        if (disposed) return { ok: false, reason: 'Studio is closing.' };
        if (result.outcome === 'resolved') remember(result.matches);
        if (selected !== generation) return { ok: true };
        if (result.outcome === 'no-key') {
          message = NO_KEY_REASON;
          return { ok: false, reason: message };
        }
        if (result.outcome !== 'resolved') {
          message = UNAVAILABLE;
          retry();
          return { ok: false, reason: message };
        }
        const next = resolve(current);
        setSeries(next);
        const incomplete =
          result.pending === true ||
          (next === null && current.ticketWins === null) ||
          (next?.games.length ?? 0) < expectedGames ||
          next?.games.some((game) => game.heroIds.length !== 10) === true ||
          next?.scoresComplete === false;
        if (incomplete) {
          message = PENDING;
          retry();
        } else {
          message = null;
          retryAttempt = 0;
        }
        return { ok: true };
      } catch {
        if (selected === generation && !disposed) {
          message = UNAVAILABLE;
          retry();
        }
        return { ok: false, reason: 'Match history is unavailable.' };
      } finally {
        if (selected === generation) loading = null;
        if (!disposed) config.notifyChanged();
      }
    })();
    loading = work;
    return work;
  }

  function handleContext(context: MatchContext): void {
    // Menus between games keep the current series; the next live match decides what follows.
    if (disposed || context.matchId === null) return;
    const { leagueId, seriesId, league: ticket } = context;
    if (leagueId !== null)
      league = { leagueId, name: ticket?.name?.trim() || `League ${leagueId}` };
    const radiant = positiveId(ticket?.radiant?.team_id);
    const dire = positiveId(ticket?.dire?.team_id);
    const radiantWins = ticket?.radiant?.series_wins;
    const direWins = ticket?.dire?.series_wins;
    const next: Target | null =
      leagueId !== null && seriesId !== null && radiant !== null && dire !== null
        ? {
            leagueId,
            seriesId,
            matchId: context.matchId,
            postGame: context.postGame,
            teams: [
              { teamId: radiant, name: ticket?.radiant?.name?.trim() || `Team ${radiant}` },
              { teamId: dire, name: ticket?.dire?.name?.trim() || `Team ${dire}` }
            ],
            ticketWins:
              validWins(radiantWins) && validWins(direWins) ? [radiantWins, direWins] : null
          }
        : null;
    const key = JSON.stringify(next);
    if (key === targetKey) return;
    targetKey = key;
    target = next;
    generation++;
    cancelRetry?.();
    cancelRetry = null;
    retryAttempt = 0;
    loading = null;
    message = null;
    setSeries(next === null ? null : resolve(next));
    config.notifyChanged();
    if (next !== null) void load();
  }

  return {
    handleContext,
    getState: (): TournamentState => ({ league, series, message }),
    refresh(): Promise<Result> {
      retryAttempt = 0;
      return load();
    },
    dispose(): void {
      disposed = true;
      generation++;
      cancelRetry?.();
    }
  };
}
