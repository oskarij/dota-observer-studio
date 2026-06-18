import { logWarning } from '../shared/logger.js';

// OpenDota's free tier is 60 req/min with no Retry-After header on 429, so callers self-impose a
// backoff. We only ever need rank_tier from GET /players/{id}.
const OPEN_DOTA_PLAYERS_URL = 'https://api.opendota.com/api/players';

// 'resolved' is a definitive answer worth persisting: a 200 (rank_tier present or null) or a 404
// (account OpenDota has never indexed -> no medal). 'transient' is 429/5xx/network — don't persist,
// retry after a short backoff.
export type RankFetchResult =
  | { readonly outcome: 'resolved'; readonly rankTier: number | null }
  | { readonly outcome: 'transient' };

export async function fetchPlayerRankTier(accountId: string): Promise<RankFetchResult> {
  try {
    const response = await fetch(`${OPEN_DOTA_PLAYERS_URL}/${accountId}`);

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
