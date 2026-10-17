import { HEROES } from './heroesData.js';

// Hero constants from tools/fetch-hero-assets.mjs, so hero ids resolve offline. `id` is both the
// GSI hero id and OpenDota's hero_id.
export interface Hero {
  readonly id: number;
  readonly internalName: string;
  readonly localizedName: string;
}

const heroesById: ReadonlyMap<number, Hero> = new Map(HEROES.map((hero) => [hero.id, hero]));

export function getHero(id: number): Hero | undefined {
  return heroesById.get(id);
}

// All heroes sorted by display name, for the manual hero picker.
const heroesByName: readonly Hero[] = [...HEROES].sort((a, b) =>
  a.localizedName.localeCompare(b.localizedName)
);

export function getAllHeroes(): readonly Hero[] {
  return heroesByName;
}
