// A curated player, by Dota account id. With a null `mmr`, known-name mode shows no medal.
// `teamId` links the player to a saved team (see teamMatching.ts).
export interface KnownPlayer {
  accountId: string;
  name: string;
  mmr: number | null;
  teamId: string | null;
}
