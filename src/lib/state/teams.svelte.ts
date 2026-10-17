import type { TeamPatch } from '../../shared/roster.js';
import type { Team } from '../../shared/team.js';
import { SavedList } from './savedList.svelte.js';

export const NO_TEAM_VALUE = '__none__';

export class TeamsStore extends SavedList<Team> {
  constructor() {
    super(() => globalThis.window?.dotaSpectatorTools?.teams);
  }
  get teams(): Team[] {
    return this.items;
  }
  get #api() {
    return globalThis.window?.dotaSpectatorTools?.teams;
  }

  byId(id: string | null): Team | null {
    return this.items.find((team) => team.id === id) ?? null;
  }

  add(value: Team): Promise<boolean> {
    return this.save(() => this.#api?.add($state.snapshot(value)));
  }
  update(id: string, patch: TeamPatch): Promise<boolean> {
    return this.save(() => this.#api?.update(id, $state.snapshot(patch)));
  }
  remove(id: string): Promise<boolean> {
    return this.save(() => this.#api?.remove(id));
  }
  pickLogo(id: string): Promise<boolean> {
    return this.save(() => this.#api?.pickLogo(id));
  }
}

export const teams = new TeamsStore();
