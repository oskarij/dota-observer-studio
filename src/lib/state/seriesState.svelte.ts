import { errorMessage, type Result } from '../../shared/result.js';
import type { StudioApi } from '../../shared/studioApi.js';
import { logWarning } from '../../shared/logger.js';
import type { SeriesSnapshot, Side } from '../../shared/seriesState.js';

const BRIDGE_UNAVAILABLE =
  'Series bridge unavailable (window.dotaSpectatorTools.series missing). Series controls will not work. Expected the Electron preload to expose it.';

export class SeriesStateStore {
  error = $state<string | null>(null);
  pending = $state(0);
  #loadVersion = 0;
  #snapshot = $state<SeriesSnapshot | null>(null);

  get snapshot(): SeriesSnapshot | null {
    return this.#snapshot;
  }

  async load(): Promise<void> {
    if (this.#api === undefined) {
      logWarning(BRIDGE_UNAVAILABLE);
      return;
    }

    const version = ++this.#loadVersion;
    try {
      const next = await this.#api.get();
      if (version === this.#loadVersion) {
        this.#snapshot = next;
        this.error = null;
      }
    } catch (error) {
      this.error = errorMessage(error);
    }
  }

  listen(): () => void {
    if (this.#api === undefined) {
      return () => {};
    }

    return this.#api.onChanged(() => {
      void this.load();
    });
  }

  async setTeam(side: Side, teamId: string | null): Promise<void> {
    await this.#command((api) => api.setTeam(side, teamId));
  }

  async swapSides(): Promise<void> {
    await this.#command((api) => api.swapSides());
  }

  async adjustScore(side: Side, delta: number): Promise<void> {
    await this.#command((api) => api.adjustScore(side, delta));
  }

  async useAutomaticScore(): Promise<void> {
    await this.#command((api) => api.useAutomaticScore());
  }

  async resetScores(): Promise<void> {
    await this.#command((api) => api.resetScores());
  }

  get #api() {
    return globalThis.window?.dotaSpectatorTools?.series;
  }

  async #command(run: (api: StudioApi['series']) => Promise<Result>): Promise<void> {
    if (this.#api === undefined) {
      logWarning(BRIDGE_UNAVAILABLE);
      return;
    }

    this.pending++;
    this.error = null;
    try {
      const result = await run(this.#api);
      if (!result.ok) throw new Error(result.reason);
      await this.load();
    } catch (error) {
      this.error = errorMessage(error);
    } finally {
      this.pending--;
    }
  }
}

export const seriesState = new SeriesStateStore();
