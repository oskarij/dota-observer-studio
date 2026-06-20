import { logWarning } from '../shared/logger.js';

// OpenDota's free tier is 60 req/min with no Retry-After header on 429, so callers self-impose a
// backoff. We need rank_tier from GET /players/{id} and the picked heroes from GET /matches/{id}.
const OPEN_DOTA_PLAYERS_URL = 'https://api.opendota.com/api/players';
const OPEN_DOTA_MATCHES_URL = 'https://api.opendota.com/api/matches';

// 'resolved' is a definitive answer worth persisting: a 200 (rank_tier present or null) or a 404
// (account OpenDota has never indexed -> no medal). 'transient' is 429/5xx/network; don't persist,
// retry after a short backoff.
export type RankFetchResult =
  | { readonly outcome: 'resolved'; readonly rankTier: number | null }
  | { readonly outcome: 'transient' };

export async function fetchPlayerRankTier(accountId: string): Promise<RankFetchResult> {
  try {
    const response = await fetch(`${OPEN_DOTA_PLAYERS_URL}/${encodeURIComponent(accountId)}`);

    // Unknown account: a definitive "no data", cached as null so we don't re-ask for 7 days.
    if (response.status === 404) {
      return { outcome: 'resolved', rankTier: null };
    }

    if (!response.ok) {
      logWarning(`OpenDota returned ${response.status} for account ${accountId}`);
      return { outcome: 'transient' };
    }

    const body = (await response.json()) as { rank_tier?: number | null };
    const rankTier = typeof body.rank_tier === 'number' ? body.rank_tier : null;

    return { outcome: 'resolved', rankTier };
  } catch (error) {
    logWarning(`OpenDota request failed for account ${accountId}`, error);
    return { outcome: 'transient' };
  }
}

// 'resolved' carries the picked hero ids (plus best-effort labelling metadata) for a fearless ban
// set. 'not-found' is a definitive miss: the match doesn't exist, or OpenDota has it but with no hero
// data yet. 'transient' is 429/5xx/network — the caller can retry.
export type MatchInfoFetchResult =
  | {
      readonly outcome: 'resolved';
      readonly heroIds: number[];
      readonly playerNames: string[]; // aligned with heroIds
      readonly radiantTeam: string | null;
      readonly direTeam: string | null;
    }
  | { readonly outcome: 'not-found' }
  | { readonly outcome: 'transient' };

export async function fetchMatchInfo(matchId: string): Promise<MatchInfoFetchResult> {
  try {
    const response = await fetch(`${OPEN_DOTA_MATCHES_URL}/${encodeURIComponent(matchId)}`);

    if (response.status === 404) {
      return { outcome: 'not-found' };
    }

    if (!response.ok) {
      logWarning(`OpenDota returned ${response.status} for match ${matchId}`);
      return { outcome: 'transient' };
    }

    const body = (await response.json()) as {
      players?: { hero_id?: number; personaname?: string | null }[];
      radiant_team?: { name?: string } | null;
      dire_team?: { name?: string } | null;
    };

    const picked = (body.players ?? []).filter(
      (player) => typeof player.hero_id === 'number' && player.hero_id > 0
    );

    // Match exists but isn't parsed / has no hero data: treat as a definitive miss for the operator.
    if (picked.length === 0) {
      return { outcome: 'not-found' };
    }

    return {
      outcome: 'resolved',
      heroIds: picked.map((player) => player.hero_id as number),
      playerNames: picked.map((player) => player.personaname ?? ''),
      radiantTeam: body.radiant_team?.name ?? null,
      direTeam: body.dire_team?.name ?? null
    };
  } catch (error) {
    logWarning(`OpenDota match request failed for ${matchId}`, error);
    return { outcome: 'transient' };
  }
}
