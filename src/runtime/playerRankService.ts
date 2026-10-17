import type { PlayerRankRecord, PlayerRankStore } from '../persistence/playerRankStore.js';
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
  readonly fetchRank?: typeof fetchPlayerRankTier;
}

export interface PlayerRankService {
  // Inspect a GSI payload for the selected player and ensure its rank is cached + pushed.
  handlePayload(payload: GsiPayload): void;
  clearSessionCache(): void;
  dispose(): void;
}

export function createPlayerRankService(config: PlayerRankServiceConfig): PlayerRankService {
  const { store, sink } = config;
  const now = config.now ?? Date.now;
  const fetchRank = config.fetchRank ?? fetchPlayerRankTier;
  let generation = 0;
  let disposed = false;

  // Per-session guards: skip duplicate SSE pushes, dedupe concurrent fetches, and respect a
  // transient-failure backoff so a render storm or a private profile doesn't hammer the API.
  const lastPushed = new Map<string, number | null>();
  const inFlight = new Set<string>();
  const backoffUntil = new Map<string, number>();
  const sessionCache = new Map<string, PlayerRankRecord>();

  function push(accountId: string, rankTier: number | null): void {
    if (lastPushed.has(accountId) && lastPushed.get(accountId) === rankTier) {
      return;
    }

    sink.setPlayerRank({ accountId, rankTier });
    lastPushed.set(accountId, rankTier);
  }

  function ensureRank(accountId: string): void {
    if (disposed) return;
    const time = now();
    const memory = sessionCache.get(accountId);
    if (memory !== undefined && time - memory.fetchedAt < SEVEN_DAYS_MS) {
      push(accountId, memory.rankTier);
      return;
    }

    if (inFlight.has(accountId) || time < (backoffUntil.get(accountId) ?? 0)) return;
    const cached = store.get(accountId);

    if (cached !== null && time - cached.fetchedAt < SEVEN_DAYS_MS) {
      sessionCache.set(accountId, cached);
      push(accountId, cached.rankTier);
      return;
    }

    inFlight.add(accountId);
    const requestedGeneration = generation;
    void fetchRank(accountId)
      .then((result) => {
        if (disposed || requestedGeneration !== generation) return;
        if (result.outcome === 'resolved') {
          backoffUntil.delete(accountId);
          const fetchedAt = now();
          store.set(accountId, result.rankTier, fetchedAt);
          sessionCache.set(accountId, { rankTier: result.rankTier, fetchedAt });
          push(accountId, result.rankTier);
        } else {
          // Transient (429/5xx/network): leave the medal absent (name only) and retry later.
          backoffUntil.set(accountId, now() + TRANSIENT_BACKOFF_MS);
        }
      })
      .catch(() => {
        if (!disposed && requestedGeneration === generation)
          backoffUntil.set(accountId, now() + TRANSIENT_BACKOFF_MS);
      })
      .finally(() => {
        if (requestedGeneration === generation) inFlight.delete(accountId);
      });
  }

  return {
    clearSessionCache() {
      generation++;
      inFlight.clear();
      sessionCache.clear();
      lastPushed.clear();
      backoffUntil.clear();
    },
    dispose() {
      disposed = true;
      generation++;
      inFlight.clear();
    },
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
