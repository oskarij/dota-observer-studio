import type { NetworkInfo } from '../../shared/networkConfig.js';

// Shared network info (ports, URLs, LAN toggle, and any failed port bind). Loaded in the layout so
// the home-page port-conflict banner and the Settings page read one source; refresh() re-fetches it
// (e.g. after a port change clears a conflict).
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
