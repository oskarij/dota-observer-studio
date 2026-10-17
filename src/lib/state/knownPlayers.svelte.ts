import type { PlayerPatch } from '../../shared/roster.js';
import type { KnownPlayer } from '../../shared/knownPlayer.js';
import { SavedList } from './savedList.svelte.js';

export class KnownPlayersStore extends SavedList<KnownPlayer> {
  constructor() {
    super(() => globalThis.window?.dotaSpectatorTools?.knownPlayers);
  }
  get players(): KnownPlayer[] {
    return this.items;
  }
  get #api() {
    return globalThis.window?.dotaSpectatorTools?.knownPlayers;
  }

  has(accountId: string): boolean {
    return this.items.some((player) => player.accountId === accountId);
  }

  add(value: KnownPlayer): Promise<boolean> {
    return this.save(() => this.#api?.add($state.snapshot(value)));
  }
  update(accountId: string, patch: PlayerPatch): Promise<boolean> {
    return this.save(() => this.#api?.update(accountId, $state.snapshot(patch)));
  }
  remove(accountId: string): Promise<boolean> {
    return this.save(() => this.#api?.remove(accountId));
  }
  replaceAll(players: KnownPlayer[]): Promise<boolean> {
    return this.save(() => this.#api?.set($state.snapshot(players)));
  }
}

export const knownPlayers = new KnownPlayersStore();
