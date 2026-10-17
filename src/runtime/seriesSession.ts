import type { FearlessStore } from '../persistence/fearlessRepository.js';
import { bannedHeroIdsFromSeries } from '../shared/fearlessDraft.js';
import { readMatchContext, type MatchContext } from '../shared/matchContext.js';
import { createFearlessCapture } from './fearlessCapture.js';
import { createFearlessService } from './fearlessService.js';
import type { GsiPayload } from './gsiListener.js';
import { createSeriesStateService, type SeriesStateServiceConfig } from './seriesStateService.js';
import { createTournamentService, type TournamentServiceConfig } from './tournamentService.js';
import type { ValveClient } from './valveClient.js';

interface SeriesSessionOptions {
  series: Omit<SeriesStateServiceConfig, 'onNewSeries'>;
  tournament: Omit<TournamentServiceConfig, 'cachedHeroIds' | 'onSeriesChanged'>;
  fearless: FearlessStore;
  fetchMatch: ValveClient['fetchMatchInfo'];
  publishPicks(heroIds: number[]): void;
  notifyPicks(): void;
  notifyWatched(): void;
}

// One GSI payload becomes one match context, read by the series, its Valve history and the
// fearless capture; the fearless pool is published from here only.
export function createSeriesSession(options: SeriesSessionOptions) {
  const { fearless } = options;
  let context: MatchContext | undefined = undefined;
  const publishPicks = (): void => {
    options.publishPicks(bannedHeroIdsFromSeries(fearless.getSeries()));
    options.notifyPicks();
  };
  const capture = createFearlessCapture({
    upsert: (game) => {
      fearless.upsertWatchedGame(game);
      options.notifyWatched();
    }
  });
  const series = createSeriesStateService({
    ...options.series,
    onNewSeries: (key) => {
      fearless.resetSeries(key);
      publishPicks();
    }
  });
  const tournament = createTournamentService({
    ...options.tournament,
    cachedHeroIds: (matchId) =>
      fearless.listWatchedGames().find((game) => game.matchId === matchId)?.heroIds ?? null,
    onSeriesChanged: (resolved) => {
      series.setHistoryWins(
        resolved === null || resolved.scoresComplete === false
          ? null
          : Object.fromEntries(resolved.teams.map((team) => [team.teamId, team.wins]))
      );
      if (resolved === null) return;
      const games = resolved.games.flatMap((game, index) =>
        game.heroIds.length === 10
          ? [{ matchId: game.matchId, heroIds: game.heroIds, label: `Game ${index + 1}` }]
          : []
      );
      if (fearless.setAutomaticSeries(games)) publishPicks();
    }
  });
  const fearlessService = createFearlessService({
    store: fearless,
    fetchMatch: options.fetchMatch,
    leagueId: () => series.getSnapshot().league?.leagueId ?? null,
    publish: publishPicks,
    notifyWatched: options.notifyWatched
  });
  fearless.selectSeries(series.key());
  options.publishPicks(bannedHeroIdsFromSeries(fearless.getSeries()));

  return {
    series,
    tournament,
    fearless: fearlessService,
    handlePayload(payload: GsiPayload): void {
      context = readMatchContext(payload, context);
      series.handleContext(context);
      tournament.handleContext(context);
      capture.handlePayload(payload);
    },
    dispose: () => tournament.dispose()
  };
}
