import type { KnownPlayer } from './knownPlayer.js';

// Linking spectated accounts to saved teams. Un-ticketed lobbies carry no team identity at all, so
// the known-players list is the only way to tell who is playing — used both to discover the matchup
// and to recognise a captured game as belonging to the current series.

// A side anchors to a team only when at least this many of its players are linked to it, so one
// shared or stand-in account can't decide a matchup.
export const MIN_LINKED_PLAYERS = 2;

export function teamIdByAccount(players: readonly KnownPlayer[]): Map<string, string> {
  const byAccount = new Map<string, string>();

  for (const player of players) {
    if (player.teamId !== null) {
      byAccount.set(player.accountId, player.teamId);
    }
  }

  return byAccount;
}

// The saved team these accounts belong to: the most-linked one, provided it clears the threshold
// and no other team ties it. Null when the accounts are unknown or split.
export function dominantTeamId(
  accountIds: Iterable<string>,
  byAccount: ReadonlyMap<string, string>
): string | null {
  const counts = new Map<string, number>();

  for (const accountId of accountIds) {
    const teamId = byAccount.get(accountId);
    if (teamId !== undefined) {
      counts.set(teamId, (counts.get(teamId) ?? 0) + 1);
    }
  }

  let best: string | null = null;
  let bestCount = 0;
  let tied = false;

  for (const [teamId, count] of counts) {
    if (count > bestCount) {
      best = teamId;
      bestCount = count;
      tied = false;
    } else if (count === bestCount) {
      tied = true;
    }
  }

  return bestCount >= MIN_LINKED_PLAYERS && !tied ? best : null;
}

// Whether a captured game was played between these two teams. The account ids aren't split by side
// here (a watched game records them flat), so both teams simply have to be well represented.
export function linksBothTeams(
  accountIds: readonly string[],
  byAccount: ReadonlyMap<string, string>,
  teamA: string,
  teamB: string
): boolean {
  let countA = 0;
  let countB = 0;

  for (const accountId of accountIds) {
    const teamId = byAccount.get(accountId);
    if (teamId === teamA) {
      countA += 1;
    } else if (teamId === teamB) {
      countB += 1;
    }
  }

  return countA >= MIN_LINKED_PLAYERS && countB >= MIN_LINKED_PLAYERS;
}
