import Store from 'electron-store';

import type { SeriesGame, WatchedGame } from '../shared/fearlessDraft.js';

const WATCHED_GAMES_KEY = 'watchedGames';
const SERIES_KEY = 'series';

// Both lists are tiny and short-lived (a fearless series lasts an evening), so they live in
// electron-store (JSON) rather than sqlite — restart-safe with no schema/migrations. The watched
// list is a capped ring buffer of the most recent games; the manual flow only ever needs the game
// just spectated, so older entries fall off.
const WATCHED_GAMES_CAP = 15;

export interface FearlessStore {
  listWatchedGames(): WatchedGame[];
  // Dedupe by match id, move to the front, trim to the cap. Returns the new list.
  upsertWatchedGame(game: WatchedGame): WatchedGame[];
  getSeries(): SeriesGame[];
  setSeries(series: SeriesGame[]): void;
}

export function createFearlessStore(): FearlessStore {
  const store = new Store<{ watchedGames: WatchedGame[]; series: SeriesGame[] }>({
    name: 'fearless-draft',
    defaults: { watchedGames: [], series: [] }
  });

  return {
    listWatchedGames() {
      return store.get(WATCHED_GAMES_KEY);
    },
    upsertWatchedGame(game) {
      const withoutDuplicate = store
        .get(WATCHED_GAMES_KEY)
        .filter((existing) => existing.matchId !== game.matchId);
      const next = [game, ...withoutDuplicate].slice(0, WATCHED_GAMES_CAP);
      store.set(WATCHED_GAMES_KEY, next);
      return next;
    },
    getSeries() {
      return store.get(SERIES_KEY);
    },
    setSeries(series) {
      store.set(SERIES_KEY, series);
    }
  };
}
