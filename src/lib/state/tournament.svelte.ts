import { errorMessage, type Result } from '../../shared/result.js';
import type { StudioApi, TournamentView } from '../../shared/studioApi.js';
import { logWarning } from '../../shared/logger.js';
import { BridgeSnapshot } from './bridgeSnapshot.svelte.js';

const BRIDGE_UNAVAILABLE =
  'Tournament bridge unavailable (window.dotaSpectatorTools.tournament missing). League lookups will not work. Expected the Electron preload to expose it.';

export class TournamentStore extends BridgeSnapshot<TournamentView, StudioApi['tournament']> {
  #busy = $state(false);

  constructor() {
    super(() => globalThis.window?.dotaSpectatorTools?.tournament, BRIDGE_UNAVAILABLE);
  }

  get state(): TournamentView | null {
    return this.value;
  }

  get busy(): boolean {
    return this.#busy;
  }

  get series() {
    return this.value?.series ?? null;
  }

  async refresh(): Promise<string | null> {
    return this.#command((api) => api.refresh());
  }

  async setApiKey(key: string | null): Promise<string | null> {
    return this.#command((api) => api.setApiKey(key));
  }

  async #command(run: (api: StudioApi['tournament']) => Promise<Result>): Promise<string | null> {
    const api = this.bridge();
    if (api === undefined) {
      logWarning(this.unavailable);
      return this.unavailable;
    }

    this.#busy = true;
    try {
      const result = await run(api);
      await this.load();
      return result.ok ? null : (result.reason ?? 'That did not work.');
    } catch (error) {
      return errorMessage(error);
    } finally {
      this.#busy = false;
    }
  }
}

export const tournament = new TournamentStore();
