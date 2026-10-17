import { logWarning } from '../shared/logger.js';

const OPEN_DOTA_PLAYERS_URL = 'https://api.opendota.com/api/players';

// 'resolved' (a 200, or a 404 for an unknown account) is cached. 'transient' (429, 5xx, network
// error) is retried after a backoff.
export type RankFetchResult =
  | { readonly outcome: 'resolved'; readonly rankTier: number | null }
  | { readonly outcome: 'transient' };

export async function fetchPlayerRankTier(accountId: string): Promise<RankFetchResult> {
  try {
    const response = await fetch(`${OPEN_DOTA_PLAYERS_URL}/${encodeURIComponent(accountId)}`);

    // Unknown account: cached as no rank.
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
