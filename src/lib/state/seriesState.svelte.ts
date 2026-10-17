import { errorMessage, type Result } from '../../shared/result.js';
import type { StudioApi } from '../../shared/studioApi.js';
import { logWarning } from '../../shared/logger.js';
import type { SeriesSnapshot, Side } from '../../shared/seriesState.js';
import { BridgeSnapshot } from './bridgeSnapshot.svelte.js';

const BRIDGE_UNAVAILABLE =
  'Series bridge unavailable (window.dotaSpectatorTools.series missing). Series controls will not work. Expected the Electron preload to expose it.';

export class SeriesStateStore extends BridgeSnapshot<SeriesSnapshot, StudioApi['series']> {
  pending = $state(0);

  constructor() {
    super(() => globalThis.window?.dotaSpectatorTools?.series, BRIDGE_UNAVAILABLE);
  }

  get snapshot(): SeriesSnapshot | null {
    return this.value;
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

  async #command(run: (api: StudioApi['series']) => Promise<Result>): Promise<void> {
    const api = this.bridge();
    if (api === undefined) {
      logWarning(this.unavailable);
      return;
    }

    this.pending++;
    this.error = null;
    try {
      const result = await run(api);
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
