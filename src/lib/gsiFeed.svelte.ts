import type { DotaGsiData } from '../shared/dotaGsiPayload.js';
import { connectOverlayRealtime } from '../overlay/overlayRealtimeClient.js';
import type { PlayerRank } from '../shared/overlayPlayerRankEvent.js';
import type { SeriesStatePayload } from '../shared/seriesState.js';

// The realtime stream as reactive state, for the studio preview's Live mode.
export class GsiFeed {
  #data = $state.raw<DotaGsiData | null>(null);
  #live = $state(false);
  // Latest rank per account id.
  #ranks = $state.raw<PlayerRank[]>([]);
  #fearlessBannedHeroIds = $state.raw<number[]>([]);
  #seriesState = $state.raw<SeriesStatePayload | null>(null);

  // null when the stream is stale/disconnected.
  get data(): DotaGsiData | null {
    return this.#data;
  }

  get live(): boolean {
    return this.#live;
  }

  get ranks(): PlayerRank[] {
    return this.#ranks;
  }

  get fearlessBannedHeroIds(): number[] {
    return this.#fearlessBannedHeroIds;
  }

  get seriesState(): SeriesStatePayload | null {
    return this.#seriesState;
  }

  start(): () => void {
    const connect = () =>
      connectOverlayRealtime({
        onGsiData: (gsiData) => {
          this.#data = gsiData;
        },
        onStatus: (status) => {
          this.#live = status === 'live';

          // Stale feed: drop the payload so the preview clears instead of freezing on old state.
          if (!this.#live) {
            this.#data = null;
          }
        },
        onPlayerRank: (rank) => {
          // A new array, so the preview's effect re-runs.
          this.#ranks = [...this.#ranks.filter((r) => r.accountId !== rank.accountId), rank];
        },
        onFearlessSeries: (payload) => {
          this.#fearlessBannedHeroIds = payload.bannedHeroIds;
        },
        onSeriesState: (payload) => {
          this.#seriesState = payload;
        },
        onConnectionChange: (state) => {
          if (state === 'disconnected') {
            this.#live = false;
            this.#data = null;
          }
        }
      });
    let disconnect: (() => void) | null = null;
    const syncVisibility = () => {
      if (document.hidden) {
        disconnect?.();
        disconnect = null;
        this.#data = null;
        this.#live = false;
      } else if (disconnect === null) {
        disconnect = connect();
      }
    };
    syncVisibility();
    document.addEventListener('visibilitychange', syncVisibility);
    return () => {
      document.removeEventListener('visibilitychange', syncVisibility);
      disconnect?.();
      this.#data = null;
      this.#live = false;
    };
  }
}
