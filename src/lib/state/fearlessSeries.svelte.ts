import {
  bannedHeroIdsFromSeries,
  type SeriesGame,
  type WatchedGame
} from '../../shared/fearlessDraft.js';
import { logWarning } from '../../shared/logger.js';

const BRIDGE_UNAVAILABLE =
  'Fearless bridge unavailable (window.dotaSpectatorTools.fearless missing). Edits will not persist. Expected the Electron preload to expose it.';

// Reactive working copy of the fearless-draft data for the studio. `watchedGames` is the
// auto-captured (+ manually fetched) history the operator picks from; `series` is the games added to
// the current fearless series. Like the known-players list, series edits persist immediately (no
// Save bar): every mutation writes the whole series back through the bridge, which re-broadcasts the
// resulting ban pool to the live overlay over SSE.
export class FearlessSeriesStore {
  #watchedGames = $state<WatchedGame[]>([]);
  #series = $state<SeriesGame[]>([]);

  get watchedGames(): WatchedGame[] {
    return this.#watchedGames;
  }

  get series(): SeriesGame[] {
    return this.#series;
  }

  // Global ban pool: every hero played across the series, de-duped.
  get bannedHeroIds(): number[] {
    return bannedHeroIdsFromSeries(this.#series);
  }

  get #api() {
    return globalThis.window?.dotaSpectatorTools?.fearless;
  }

  async load(): Promise<void> {
    if (this.#api === undefined) {
      logWarning(BRIDGE_UNAVAILABLE);
      return;
    }

    this.#watchedGames = await this.#api.getWatchedGames();
    this.#series = await this.#api.getSeries();
  }

  // Subscribe to the main process's "a game was captured/fetched" notification so the watched list
  // refreshes live while the page is open. Returns an unsubscribe for the page's onMount cleanup.
  subscribe(): () => void {
    if (this.#api === undefined) {
      return () => {};
    }

    return this.#api.onWatchedGamesChanged(() => {
      void this.#refreshWatchedGames();
    });
  }

  isInSeries(matchId: string): boolean {
    return this.#series.some((game) => game.matchId === matchId);
  }

  addToSeries(game: WatchedGame): void {
    if (this.isInSeries(game.matchId)) {
      return;
    }

    void this.#persistSeries([
      ...this.#series,
      { matchId: game.matchId, heroIds: game.heroIds, label: seriesLabel(game) }
    ]);
  }

  // Add a hand-picked game (used when OpenDota can't parse a match). It goes straight to the series
  // with a synthetic id, since there's no real match to record in the watched list.
  addManualSeriesGame(heroIds: number[]): void {
    if (heroIds.length === 0) {
      return;
    }

    const matchId = `manual-${Date.now()}`;
    void this.#persistSeries([
      ...this.#series,
      { matchId, heroIds, label: `Manual entry (${heroIds.length} heroes)` }
    ]);
  }

  removeFromSeries(matchId: string): void {
    void this.#persistSeries(this.#series.filter((game) => game.matchId !== matchId));
  }

  clearSeries(): void {
    void this.#persistSeries([]);
  }

  // Pull an un-spectated game's heroes from OpenDota into the watched list. The list refresh comes
  // through the change notification, but we also refresh here so it updates even if that's missed.
  async fetchMatch(matchId: string): Promise<{ ok: boolean; reason?: string }> {
    if (this.#api === undefined) {
      return { ok: false, reason: BRIDGE_UNAVAILABLE };
    }

    const result = await this.#api.fetchMatch(matchId);
    if (result.ok) {
      await this.#refreshWatchedGames();
    }

    return result;
  }

  async #refreshWatchedGames(): Promise<void> {
    if (this.#api === undefined) {
      return;
    }

    this.#watchedGames = await this.#api.getWatchedGames();
  }

  async #persistSeries(next: SeriesGame[]): Promise<void> {
    // Update the reactive copy first so the UI + preview react immediately; the write is durable and
    // triggers the overlay broadcast.
    this.#series = next;

    if (this.#api === undefined) {
      logWarning(BRIDGE_UNAVAILABLE);
      return;
    }

    await this.#api.setSeries($state.snapshot(next));
  }
}

// A human label for a game in the series: OpenDota team names when available, else the spectated
// player names (Radiant vs Dire), else the bare match id.
function seriesLabel(game: WatchedGame): string {
  if (game.radiantTeam !== undefined && game.direTeam !== undefined) {
    return `${game.radiantTeam} vs ${game.direTeam}`;
  }

  const names = game.playerNames ?? [];
  if (names.some((name) => name !== '')) {
    const radiant = names
      .slice(0, 5)
      .filter((name) => name !== '')
      .join(', ');
    const dire = names
      .slice(5, 10)
      .filter((name) => name !== '')
      .join(', ');
    return `${radiant} vs ${dire}`;
  }

  return `Match ${game.matchId}`;
}

// Shared instance; the Fearless page loads + subscribes it on mount.
export const fearlessSeries = new FearlessSeriesStore();
