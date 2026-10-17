import type { FearlessSeriesState, SeriesGame, WatchedGame } from '../shared/fearlessDraft.js';

export interface FearlessData {
  watchedGames: WatchedGame[];
  series: SeriesGame[];
  automaticSeries: SeriesGame[];
  manualOverride: boolean | null;
  revision: number;
  seriesKey?: string | null;
}

export interface FearlessStorage {
  get<K extends keyof FearlessData>(key: K): FearlessData[K];
  set(value: Partial<FearlessData>): void;
}

export const EMPTY_FEARLESS_DATA: FearlessData = {
  watchedGames: [],
  series: [],
  automaticSeries: [],
  manualOverride: null,
  revision: 0
};
const WATCHED_GAMES_KEY = 'watchedGames';
const SERIES_KEY = 'series';
const WATCHED_GAMES_CAP = 15;

export function createFearlessRepository(store: FearlessStorage) {
  // Preserve any existing curated pool when upgrading from before explicit overrides.
  if (store.get('manualOverride') === null)
    store.set({ manualOverride: store.get(SERIES_KEY).length > 0 });

  function resetSeries(seriesKey = store.get('seriesKey') ?? null): void {
    store.set({
      series: [],
      automaticSeries: [],
      manualOverride: false,
      seriesKey,
      revision: store.get('revision') + 1
    });
  }

  return {
    listWatchedGames() {
      return store.get(WATCHED_GAMES_KEY);
    },
    upsertWatchedGame(game: WatchedGame) {
      const withoutDuplicate = store
        .get(WATCHED_GAMES_KEY)
        .filter((existing) => existing.matchId !== game.matchId);
      const next = [game, ...withoutDuplicate].slice(0, WATCHED_GAMES_CAP);
      store.set({ watchedGames: next });
      return next;
    },
    getSeries() {
      return store.get(SERIES_KEY);
    },
    getSeriesState(): FearlessSeriesState {
      return {
        games: store.get(SERIES_KEY),
        manualOverride: store.get('manualOverride') === true,
        revision: store.get('revision')
      };
    },
    setSeries(series: SeriesGame[]) {
      store.set({ series, manualOverride: true, revision: store.get('revision') + 1 });
    },
    setAutomaticSeries(series: SeriesGame[]) {
      if (JSON.stringify(store.get('automaticSeries')) === JSON.stringify(series)) return false;
      if (store.get('manualOverride')) {
        store.set({ automaticSeries: series });
        return false;
      }
      store.set({ automaticSeries: series, series, revision: store.get('revision') + 1 });
      return true;
    },
    useAutomaticSeries() {
      store.set({
        series: store.get('automaticSeries'),
        manualOverride: false,
        revision: store.get('revision') + 1
      });
    },
    selectSeries(seriesKey: string | null) {
      const previous = store.get('seriesKey');
      if (previous === undefined) store.set({ seriesKey });
      else if (previous !== seriesKey) resetSeries(seriesKey);
    },
    resetSeries
  };
}

export type FearlessStore = ReturnType<typeof createFearlessRepository>;
