import type { PlayerRankStore } from '../persistence/playerRankStore.js';
import { isValidAccountId } from '../shared/accountId.js';
import { getSelectedDotaGsiPlayer } from '../shared/dotaGsiPayload.js';
import type { PlayerRank } from '../shared/overlayPlayerRankEvent.js';
import type { GsiPayload } from './gsiListener.js';
import { fetchPlayerRankTier } from './openDotaClient.js';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
// OpenDota's per-minute window with a little headroom, used to back off after a transient failure.
const TRANSIENT_BACKOFF_MS = 70_000;

export interface PlayerRankSink {
  setPlayerRank(rank: PlayerRank): void;
}

export interface PlayerRankServiceConfig {
  readonly store: PlayerRankStore;
  readonly sink: PlayerRankSink;
  // Injectable for tests.
  readonly now?: () => number;
}

export interface PlayerRankService {
  // Inspect a GSI payload for the selected player and ensure its rank is cached + pushed.
  handlePayload(payload: GsiPayload): void;
}

export function createPlayerRankService(config: PlayerRankServiceConfig): PlayerRankService {
  const { store, sink } = config;
  const now = config.now ?? Date.now;

  // Per-session guards: skip duplicate SSE pushes, dedupe concurrent fetches, and respect a
  // transient-failure backoff so a render storm or a private profile doesn't hammer the API.
  const lastPushed = new Map<string, number | null>();
  const inFlight = new Set<string>();
  const backoffUntil = new Map<string, number>();

  function push(accountId: string, rankTier: number | null): void {
    if (lastPushed.has(accountId) && lastPushed.get(accountId) === rankTier) {
      return;
    }

    lastPushed.set(accountId, rankTier);
    sink.setPlayerRank({ accountId, rankTier });
  }

  function ensureRank(accountId: string): void {
    const cached = store.get(accountId);

    if (cached !== null && now() - cached.fetchedAt < SEVEN_DAYS_MS) {
      push(accountId, cached.rankTier);
      return;
    }

    if (inFlight.has(accountId)) {
      return;
    }

    const retryAt = backoffUntil.get(accountId);
    if (retryAt !== undefined && now() < retryAt) {
      return;
    }

    inFlight.add(accountId);
    void fetchPlayerRankTier(accountId)
      .then((result) => {
        if (result.outcome === 'resolved') {
          backoffUntil.delete(accountId);
          store.set(accountId, result.rankTier, now());
          push(accountId, result.rankTier);
        } else {
          // Transient (429/5xx/network): leave the medal absent (name only) and retry later.
          backoffUntil.set(accountId, now() + TRANSIENT_BACKOFF_MS);
        }
      })
      .finally(() => {
        inFlight.delete(accountId);
      });
  }

  return {
    handlePayload(payload) {
      const selected = getSelectedDotaGsiPlayer(payload);
      const accountId = selected?.player?.accountid;

      // A non-numeric id can only come from a malformed or forged GSI payload; drop it before it
      // becomes a cache key or an OpenDota URL segment.
      if (accountId === undefined || !isValidAccountId(accountId)) {
        return;
      }

      ensureRank(accountId);
    }
  };
}
