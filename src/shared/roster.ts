import type { KnownPlayer } from './knownPlayer.js';
import type { Team } from './team.js';
import { isRecord } from './validation.js';

export interface RosterSnapshot<T> {
  items: T[];
  warning: string | null;
}

export type TeamPatch = Partial<Pick<Team, 'name' | 'tag' | 'logoPath' | 'externalTeamId'>>;
export type PlayerPatch = Partial<Omit<KnownPlayer, 'accountId'>>;

export const SAFE_TEAM_ID = /^[a-z0-9-]+$/i;

export function isTeam(value: unknown): value is Team {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    SAFE_TEAM_ID.test(value.id) &&
    typeof value.name === 'string' &&
    value.name.trim().length > 0 &&
    typeof value.tag === 'string' &&
    (value.logoPath === null ||
      (typeof value.logoPath === 'string' && value.logoPath.startsWith('/media/team-logos/'))) &&
    (value.externalTeamId === null ||
      (typeof value.externalTeamId === 'number' &&
        Number.isSafeInteger(value.externalTeamId) &&
        value.externalTeamId > 0))
  );
}

export function isKnownPlayer(value: unknown): value is KnownPlayer {
  return (
    isRecord(value) &&
    typeof value.accountId === 'string' &&
    /^\d+$/.test(value.accountId) &&
    typeof value.name === 'string' &&
    value.name.trim().length > 0 &&
    (value.mmr === null ||
      (typeof value.mmr === 'number' && Number.isSafeInteger(value.mmr) && value.mmr >= 0)) &&
    (value.teamId === null || (typeof value.teamId === 'string' && SAFE_TEAM_ID.test(value.teamId)))
  );
}
