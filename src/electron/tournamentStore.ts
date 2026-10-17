import { safeStorage } from 'electron';
import Store from 'electron-store';

import type { PersistedTournament } from '../runtime/tournamentService.js';

export interface TournamentStore {
  get(): Partial<PersistedTournament>;
  set(tournament: PersistedTournament): void;
  getApiKey(): string | null;
  setApiKey(key: string | null): void;
}

export function createTournamentStore(): TournamentStore {
  // The Steam key is sealed with the OS keystore (DPAPI on Windows), so the settings file never
  // holds it in plain text.
  const store = new Store<{ tournament: PersistedTournament; steamApiKey?: string }>({
    name: 'tournament',
    defaults: { tournament: { matches: [] } }
  });

  return {
    get: () => store.get('tournament'),
    set: (tournament) => {
      store.set('tournament', tournament);
    },
    getApiKey: () => {
      const sealed = store.get('steamApiKey');
      if (sealed === undefined) return null;
      try {
        return safeStorage.decryptString(Buffer.from(sealed, 'base64'));
      } catch {
        return null;
      }
    },
    setApiKey: (key) => {
      if (key === null) store.delete('steamApiKey');
      else store.set('steamApiKey', safeStorage.encryptString(key).toString('base64'));
    }
  };
}
