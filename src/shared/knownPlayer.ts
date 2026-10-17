// A curated player the studio recognises by Dota account id. Edited in the studio, persisted to
// SQLite, and pushed to the live overlay so "Known name" mode can show a stable name + MMR-derived
// medal. `mmr` is null when unknown (the medal then falls back to the in-game / OpenDota source).
// `teamId` optionally links the player to a saved team so live games can be side-matched to teams.
export interface KnownPlayer {
  accountId: string;
  name: string;
  mmr: number | null;
  teamId: string | null;
}
