import Store from 'electron-store';

import { createDefaultSeriesState, type PersistedSeriesState } from '../shared/seriesState.js';

export interface SeriesStore {
  // Unvalidated: the series service parses it, so state from older versions starts fresh.
  get(): unknown;
  set(state: PersistedSeriesState): void;
}

export function createSeriesStore(): SeriesStore {
  const store = new Store<{ state: unknown }>({
    name: 'series',
    defaults: { state: createDefaultSeriesState() }
  });

  return {
    get: () => store.get('state'),
    set: (state) => {
      store.set('state', state);
    }
  };
}
