import { HEROES } from './heroesData.js';

// Static hero constants (id -> internal/localized name), generated from OpenDota's constants by
// scripts/fetch-hero-assets.mjs and committed so the app resolves hero ids fully offline. `id`
// matches both the GSI hero id and OpenDota's hero_id, so one table serves every source. The
// matching portrait icons live next to the fearless-draft overlay element (see heroIcons.ts there).
// The data is a generated .ts module (not JSON) so it compiles cleanly under both the NodeNext and
// ES2022 tsconfigs that include src/shared.
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
