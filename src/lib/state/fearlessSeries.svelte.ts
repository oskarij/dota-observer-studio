import {
  bannedHeroIdsFromSeries,
  type FearlessCommand,
  type FearlessSeriesState,
  type WatchedGame
} from '../../shared/fearlessDraft.js';
import { errorMessage, type Result } from '../../shared/result.js';

export class FearlessSeriesStore {
  #watchedGames = $state<WatchedGame[]>([]);
  #state = $state<FearlessSeriesState>({ games: [], manualOverride: false, revision: 0 });
  error = $state<string | null>(null);
  pending = $state(0);
  get revision() {
    return this.#state.revision;
  }
  get manualOverride() {
    return this.#state.manualOverride;
  }
  get watchedGames() {
    return this.#watchedGames;
  }
  get series() {
    return this.#state.games;
  }
  get bannedHeroIds() {
    return bannedHeroIdsFromSeries(this.series);
  }
  get #api() {
    return globalThis.window?.dotaSpectatorTools?.fearless;
  }

  async load(): Promise<void> {
    await Promise.all([this.#refreshWatchedGames(), this.#refreshSeries()]);
  }
  subscribe(): () => void {
    const api = this.#api;
    if (!api) return () => {};
    const watched = api.onWatchedGamesChanged(() => {
      void this.#refreshWatchedGames();
    });
    const series = api.onSeriesChanged(() => {
      void this.#refreshSeries();
    });
    return () => {
      watched();
      series();
    };
  }
  isInSeries(matchId: string): boolean {
    return this.series.some((game) => game.matchId === matchId);
  }
  addToSeries(game: WatchedGame, revision = this.revision): Promise<boolean> {
    return this.#edit(
      {
        kind: 'add',
        game: { matchId: game.matchId, heroIds: game.heroIds, label: seriesLabel(game) }
      },
      revision
    );
  }
  addManualSeriesGame(heroIds: number[], revision = this.revision): Promise<boolean> {
    return this.#edit(
      {
        kind: 'add',
        game: {
          matchId: 'manual-' + globalThis.crypto.randomUUID(),
          heroIds,
          label: `Manual entry (${heroIds.length} heroes)`
        }
      },
      revision
    );
  }
  removeFromSeries(matchId: string): Promise<boolean> {
    return this.#edit({ kind: 'remove', matchId });
  }
  clearSeries(): Promise<boolean> {
    return this.#edit({ kind: 'clear' });
  }
  useAutomaticSeries(): Promise<boolean> {
    return this.#edit({ kind: 'automatic' });
  }

  async fetchMatch(matchId: string): Promise<Result<{ game: WatchedGame }>> {
    try {
      if (!this.#api) throw new Error('Open the desktop app to fetch a match.');
      return await this.#api.fetchMatch(matchId);
    } catch (error) {
      return { ok: false, reason: errorMessage(error) };
    }
  }
  async #refreshWatchedGames(): Promise<void> {
    try {
      if (this.#api) this.#watchedGames = await this.#api.getWatchedGames();
    } catch (error) {
      this.error = errorMessage(error);
    }
  }
  async #refreshSeries(): Promise<void> {
    try {
      const next = await this.#api?.getSeries();
      if (next && next.revision >= this.revision) this.#state = next;
    } catch (error) {
      this.error = errorMessage(error);
    }
  }
  async #edit(command: FearlessCommand, revision = this.revision): Promise<boolean> {
    this.pending++;
    this.error = null;
    try {
      if (!this.#api) throw new Error('Open the desktop app to edit picks.');
      const result = await this.#api.editSeries($state.snapshot(command), revision);
      if (!result.ok) throw new Error(result.reason);
      if (result.state.revision >= this.revision) this.#state = result.state;
      return true;
    } catch (error) {
      this.error = errorMessage(error);
      return false;
    } finally {
      this.pending--;
    }
  }
}

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

export const fearlessSeries = new FearlessSeriesStore();
