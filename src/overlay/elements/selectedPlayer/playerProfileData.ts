import { logWarning } from '../../../shared/logger.js';

export type RankMedal =
  | 'ancient'
  | 'archon'
  | 'crusader'
  | 'divine'
  | 'guardian'
  | 'herald'
  | 'immortal'
  | 'legend';

export interface PlayerProfile {
  readonly accountId: string;
  readonly mmr: number | null;
  readonly name: string;
}

export function mmrToMedal(mmr: number | null): RankMedal | null {
  if (mmr === null) {
    return null;
  }

  if (mmr >= 5620) {
    return 'immortal';
  }

  if (mmr >= 4260) {
    return 'divine';
  }

  if (mmr >= 3850) {
    return 'ancient';
  }

  if (mmr >= 3080) {
    return 'legend';
  }

  if (mmr >= 2310) {
    return 'archon';
  }

  if (mmr >= 1540) {
    return 'crusader';
  }

  if (mmr >= 770) {
    return 'guardian';
  }

  return 'herald';
}

// OpenDota encodes rank as a two-digit rank_tier: the tens digit is the medal (1=Herald..8=Immortal)
// and the ones digit is the star count, which we don't surface. null = no public rank -> no medal.
export function rankTierToMedal(rankTier: number | null): RankMedal | null {
  if (rankTier === null) {
    return null;
  }

  switch (Math.floor(rankTier / 10)) {
    case 1:
      return 'herald';
    case 2:
      return 'guardian';
    case 3:
      return 'crusader';
    case 4:
      return 'archon';
    case 5:
      return 'legend';
    case 6:
      return 'ancient';
    case 7:
      return 'divine';
    case 8:
      return 'immortal';
    default:
      return null;
  }
}

export function parsePlayerProfilesYaml(yaml: string): PlayerProfile[] {
  const profiles: PlayerProfile[] = [];
  let currentProfile: PlayerProfileDraft | null = null;

  function commitCurrentProfile(): void {
    if (currentProfile?.accountId === undefined) {
      return;
    }

    profiles.push({
      accountId: currentProfile.accountId,
      mmr: currentProfile.mmr ?? null,
      name: currentProfile.name ?? currentProfile.accountId
    });
    currentProfile = null;
  }

  for (const rawLine of yaml.split(/\r?\n/u)) {
    const line = stripComment(rawLine).trim();

    if (line.length === 0) {
      continue;
    }

    const accountId = parseAccountIdKey(line);

    if (accountId !== null) {
      commitCurrentProfile();
      currentProfile = {
        accountId
      };
      continue;
    }

    if (currentProfile !== null) {
      applyPlayerProfileLine(currentProfile, line);
    }
  }

  commitCurrentProfile();

  return profiles;
}

interface PlayerProfileDraft {
  accountId?: string;
  mmr?: number | null;
  name?: string;
}

function applyPlayerProfileLine(profile: PlayerProfileDraft, line: string): void {
  const match = /^([A-Za-z_][A-Za-z0-9_ ]*):\s*(.*)$/u.exec(line);

  if (match === null) {
    logWarning(`Ignoring malformed player profile line: ${line}`);
    return;
  }

  const [, rawKey, rawValue] = match;

  if (rawKey === undefined || rawValue === undefined) {
    return;
  }

  const key = normalizeYamlKey(rawKey);
  const value = parseYamlScalar(rawValue);

  if (key === 'accountid') {
    profile.accountId = value;
    return;
  }

  if (key === 'name') {
    profile.name = value;
    return;
  }

  if (key === 'mmr') {
    profile.mmr = parseMmr(value);
    return;
  }

  logWarning(`Ignoring unknown player profile field: ${rawKey}`);
}

function normalizeYamlKey(key: string): string {
  return key.replaceAll(/[_\s]/gu, '').toLowerCase();
}

function parseMmr(value: string): number | null {
  const mmr = Number(value);

  return Number.isFinite(mmr) ? mmr : null;
}

function parseYamlScalar(value: string): string {
  const trimmedValue = value.trim();

  if (
    (trimmedValue.startsWith('"') && trimmedValue.endsWith('"')) ||
    (trimmedValue.startsWith("'") && trimmedValue.endsWith("'"))
  ) {
    return trimmedValue.slice(1, -1);
  }

  return trimmedValue;
}

function parseAccountIdKey(line: string): string | null {
  const match = /^([0-9]+):$/u.exec(line);

  if (match === null) {
    return null;
  }

  const [, accountId] = match;

  if (accountId === undefined) {
    return null;
  }

  return accountId;
}

function stripComment(line: string): string {
  const commentIndex = line.indexOf('#');

  if (commentIndex === -1) {
    return line;
  }

  return line.slice(0, commentIndex);
}
