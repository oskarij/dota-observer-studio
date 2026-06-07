import playersYaml from './players.yaml?raw';
import { parsePlayerProfilesYaml, type PlayerProfile } from './playerProfileData.js';

const playerProfiles = parsePlayerProfilesYaml(playersYaml);
const playerProfilesByAccountId = new Map(
  playerProfiles.map((profile) => [profile.accountId, profile])
);

export function getPlayerProfile(accountId: string | undefined): PlayerProfile | null {
  if (accountId === undefined) {
    return null;
  }

  return playerProfilesByAccountId.get(accountId) ?? null;
}
