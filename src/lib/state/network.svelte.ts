import type { NetworkInfo } from '../../shared/networkConfig.js';

// Loaded once in the layout; the port-conflict banner and the Settings page share it.
class NetworkStore {
  #info = $state<NetworkInfo | null>(null);

  get info(): NetworkInfo | null {
    return this.#info;
  }

  get hasPortConflict(): boolean {
    return (
      this.#info !== null &&
      (this.#info.portConflicts.overlayHost || this.#info.portConflicts.gsiListener)
    );
  }

  async refresh(): Promise<void> {
    this.#info = (await globalThis.window?.dotaSpectatorTools?.network?.get()) ?? null;
  }
}

export const network = new NetworkStore();
