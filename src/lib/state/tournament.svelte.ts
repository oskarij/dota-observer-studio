import { errorMessage, type Result } from '../../shared/result.js';
import type { StudioApi, TournamentView } from '../../shared/studioApi.js';
import { logWarning } from '../../shared/logger.js';

const BRIDGE_UNAVAILABLE =
  'Tournament bridge unavailable (window.dotaSpectatorTools.tournament missing). League lookups will not work. Expected the Electron preload to expose it.';

export class TournamentStore {
  #state = $state<TournamentView | null>(null);
  #busy = $state(false);
  error = $state<string | null>(null);
  #loadVersion = 0;

  get state(): TournamentView | null {
    return this.#state;
  }

  get busy(): boolean {
    return this.#busy;
  }

  get series() {
    return this.#state?.series ?? null;
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
        this.#state = next;
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

  async refresh(): Promise<string | null> {
    return this.#command((api) => api.refresh());
  }

  async setApiKey(key: string | null): Promise<string | null> {
    return this.#command((api) => api.setApiKey(key));
  }

  get #api() {
    return globalThis.window?.dotaSpectatorTools?.tournament;
  }

  async #command(run: (api: StudioApi['tournament']) => Promise<Result>): Promise<string | null> {
    const api = this.#api;
    if (api === undefined) {
      logWarning(BRIDGE_UNAVAILABLE);
      return BRIDGE_UNAVAILABLE;
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
