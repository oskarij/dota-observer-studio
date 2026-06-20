import { ipcMain } from 'electron';

import type { OverlayGsiEventStream } from '../../runtime/overlayGsiEventStream.js';
import { fetchMatchInfo } from '../../runtime/openDotaClient.js';
import {
  bannedHeroIdsFromSeries,
  type SeriesGame,
  type WatchedGame
} from '../../shared/fearlessDraft.js';
import {
  FEARLESS_FETCH_MATCH_CHANNEL,
  FEARLESS_SERIES_GET_CHANNEL,
  FEARLESS_SERIES_SET_CHANNEL,
  WATCHED_GAMES_GET_CHANNEL
} from '../../shared/ipcChannels.js';
import type { FearlessStore } from '../fearlessStore.js';

export interface FearlessFetchMatchResult {
  ok: boolean;
  game?: WatchedGame;
  reason?: string;
}

// Persists the fearless series and fans the resulting ban pool out to live-overlay clients, mirroring
// the known-players IPC. The renderer owns the series as a working set (immediate persistence, no
// Save bar); main is the source of truth the overlay reads over SSE. fetch-match pulls an
// un-spectated game's heroes from OpenDota into the watched list, then notifies the renderer so its
// list refreshes — the same notification the live GSI capture uses.
export function registerFearlessDraftIpc(
  store: FearlessStore,
  eventStream: OverlayGsiEventStream,
  notifyWatchedGamesChanged: () => void
): () => void {
  // Seed the stream so an overlay opened before the studio still gets the saved ban pool.
  eventStream.setFearlessSeries({ bannedHeroIds: bannedHeroIdsFromSeries(store.getSeries()) });

  ipcMain.handle(WATCHED_GAMES_GET_CHANNEL, () => store.listWatchedGames());
  ipcMain.handle(FEARLESS_SERIES_GET_CHANNEL, () => store.getSeries());
  ipcMain.handle(FEARLESS_SERIES_SET_CHANNEL, (_event, series: SeriesGame[]) => {
    store.setSeries(series);
    eventStream.setFearlessSeries({ bannedHeroIds: bannedHeroIdsFromSeries(series) });
  });

  ipcMain.handle(
    FEARLESS_FETCH_MATCH_CHANNEL,
    async (_event, matchId: string): Promise<FearlessFetchMatchResult> => {
      const trimmed = matchId.trim();
      if (!/^\d+$/.test(trimmed)) {
        return { ok: false, reason: 'Enter a numeric match ID.' };
      }

      const result = await fetchMatchInfo(trimmed);
      if (result.outcome === 'not-found') {
        return { ok: false, reason: 'Match not found or not yet available on OpenDota.' };
      }
      if (result.outcome === 'transient') {
        return { ok: false, reason: 'OpenDota is unavailable right now. Try again shortly.' };
      }

      const hasNames = result.playerNames.some((name) => name !== '');
      const game: WatchedGame = {
        matchId: trimmed,
        capturedAt: Date.now(),
        heroIds: result.heroIds,
        source: 'opendota',
        ...(hasNames ? { playerNames: result.playerNames } : {}),
        ...(result.radiantTeam !== null ? { radiantTeam: result.radiantTeam } : {}),
        ...(result.direTeam !== null ? { direTeam: result.direTeam } : {})
      };
      store.upsertWatchedGame(game);
      notifyWatchedGamesChanged();
      return { ok: true, game };
    }
  );

  return () => {
    ipcMain.removeHandler(WATCHED_GAMES_GET_CHANNEL);
    ipcMain.removeHandler(FEARLESS_SERIES_GET_CHANNEL);
    ipcMain.removeHandler(FEARLESS_SERIES_SET_CHANNEL);
    ipcMain.removeHandler(FEARLESS_FETCH_MATCH_CHANNEL);
  };
}
