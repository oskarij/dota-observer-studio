import type { FearlessStore } from '../persistence/fearlessRepository.js';
import {
  type FearlessSeriesState,
  type SeriesGame,
  type WatchedGame
} from '../shared/fearlessDraft.js';
import { errorMessage, type Result } from '../shared/result.js';
import { isRecord } from '../shared/validation.js';
import { NO_KEY_REASON, type ValveClient } from './valveClient.js';

export interface FearlessServiceOptions {
  store: FearlessStore;
  fetchMatch: ValveClient['fetchMatchInfo'];
  leagueId(): number | null;
  // Pushes the ban pool to the overlay and tells the studio; shared with automatic picks.
  publish(): void;
  notifyWatched(): void;
}

function isSeriesGame(value: unknown): value is SeriesGame {
  return (
    isRecord(value) &&
    typeof value.matchId === 'string' &&
    value.matchId.length > 0 &&
    typeof value.label === 'string' &&
    Array.isArray(value.heroIds) &&
    value.heroIds.length > 0 &&
    value.heroIds.length <= 10 &&
    value.heroIds.every(
      (id: unknown) => typeof id === 'number' && Number.isSafeInteger(id) && id > 0
    ) &&
    new Set(value.heroIds).size === value.heroIds.length
  );
}

export function createFearlessService(options: FearlessServiceOptions) {
  const { store, publish } = options;

  return {
    getSeries: () => store.getSeriesState(),
    getWatched: () => store.listWatchedGames(),
    edit(command: unknown, revision: unknown): Result<{ state: FearlessSeriesState }> {
      if (revision !== store.getSeriesState().revision)
        return { ok: false, reason: 'The series changed. Check the current games and try again.' };
      if (!isRecord(command)) return { ok: false, reason: 'Invalid series edit.' };
      try {
        const games = store.getSeries();
        switch (command.kind) {
          case 'add': {
            if (!isSeriesGame(command.game))
              return { ok: false, reason: 'Invalid game or hero picks.' };
            const added = command.game;
            if (games.some((game) => game.matchId === added.matchId))
              return { ok: true, state: store.getSeriesState() };
            store.setSeries([...games, added]);
            break;
          }
          case 'remove':
            if (typeof command.matchId !== 'string')
              return { ok: false, reason: 'Invalid match ID.' };
            store.setSeries(games.filter((game) => game.matchId !== command.matchId));
            break;
          case 'clear':
            store.setSeries([]);
            break;
          case 'automatic':
            store.useAutomaticSeries();
            break;
          default:
            return { ok: false, reason: 'Unknown series edit.' };
        }
        publish();
        return { ok: true, state: store.getSeriesState() };
      } catch (error) {
        return { ok: false, reason: errorMessage(error) };
      }
    },
    async fetchMatch(value: unknown): Promise<Result<{ game: WatchedGame }>> {
      if (typeof value !== 'string' || !/^\d+$/.test(value.trim()))
        return { ok: false, reason: 'Enter a numeric match ID.' };
      const matchId = value.trim();
      try {
        const result = await options.fetchMatch(matchId, options.leagueId() ?? undefined);
        if (result.outcome === 'not-found')
          return {
            ok: false,
            reason:
              'Match not found in the selected tournament. Check its league or pick the heroes manually.'
          };
        if (result.outcome === 'no-key') return { ok: false, reason: NO_KEY_REASON };
        if (result.outcome === 'transient')
          return { ok: false, reason: 'Match data is unavailable right now. Try again shortly.' };
        const game: WatchedGame = {
          matchId,
          capturedAt: Date.now(),
          heroIds: result.heroIds,
          source: 'valve'
        };
        store.upsertWatchedGame(game);
        options.notifyWatched();
        return { ok: true, game };
      } catch (error) {
        return { ok: false, reason: errorMessage(error) };
      }
    }
  };
}

export type FearlessService = ReturnType<typeof createFearlessService>;
