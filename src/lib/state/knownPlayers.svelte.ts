import type { KnownPlayer } from '../../shared/knownPlayer.js';
import { logWarning } from '../../shared/logger.js';

const BRIDGE_UNAVAILABLE =
  'Known-players bridge unavailable (window.dotaSpectatorTools.knownPlayers missing). Edits will not persist. Expected the Electron preload to expose it.';

// Reactive working copy of the curated known-players list, shared app-wide so the Components page
// editor and the Overlay page preview read one source. Unlike the overlay config, edits persist
// immediately (no Save bar): every mutation writes the whole list back through the bridge, which
// re-broadcasts it to the live overlay.
export class KnownPlayersStore {
  #players = $state<KnownPlayer[]>([]);

  get players(): KnownPlayer[] {
    return this.#players;
  }

  async load(): Promise<void> {
    if (this.#api === undefined) {
      logWarning(BRIDGE_UNAVAILABLE);
      return;
    }

    this.#players = await this.#api.get();
  }

  // Editor uses this to block duplicate keys; otherwise the SQLite primary-key swap silently drops one.
  has(accountId: string): boolean {
    return this.#players.some((player) => player.accountId === accountId);
  }

  add(player: KnownPlayer): void {
    void this.#persist([...this.#players, player]);
  }

  update(accountId: string, next: KnownPlayer): void {
    void this.#persist(
      this.#players.map((player) => (player.accountId === accountId ? next : player))
    );
  }

  remove(accountId: string): void {
    void this.#persist(this.#players.filter((player) => player.accountId !== accountId));
  }

  // Replaces the whole list in one write; used by CSV import, which has already validated + deduped.
  replaceAll(players: KnownPlayer[]): void {
    void this.#persist(players);
  }

  get #api() {
    return globalThis.window?.dotaSpectatorTools?.knownPlayers;
  }

  async #persist(next: KnownPlayer[]): Promise<void> {
    // Update reactive copy first so UI + preview react immediately; the write is durable + the overlay broadcast.
    this.#players = next;

    if (this.#api === undefined) {
      logWarning(BRIDGE_UNAVAILABLE);
      return;
    }

    await this.#api.set($state.snapshot(next));
  }
}

// Shared instance, loaded once from the layout (like overlayConfig).
export const knownPlayers = new KnownPlayersStore();
