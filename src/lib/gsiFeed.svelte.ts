import type { DotaGsiData } from '../shared/dotaGsiPayload.js';
import { connectOverlayRealtime } from '../overlay/overlayRealtimeClient.js';
import type { PlayerRank } from '../shared/overlayPlayerRankEvent.js';

// Latest live GSI payload + ranks from the realtime stream, for the studio preview's "Live" mode.
// Decodes the stream through the shared realtime client (the same one the standalone overlay uses,
// so the two can't drift) but keeps the data as reactive state instead of pushing it into a stage.
export class GsiFeed {
  #data = $state<DotaGsiData | null>(null);
  #live = $state(false);
  // OpenDota ranks pushed over SSE, latest per account id; the preview feeds these to the stage
  // so in-game name mode shows a medal, mirroring the standalone overlay (overlay.ts).
  #ranks = $state<PlayerRank[]>([]);
  // Latest fearless ban pool pushed over SSE, fed to the stage so the live preview shows the same
  // draft grid as the standalone overlay.
  #fearlessBannedHeroIds = $state<number[]>([]);

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

  start(): () => void {
    return connectOverlayRealtime({
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
        // Replace any prior rank for this account; new array so the preview's effect re-runs.
        this.#ranks = [...this.#ranks.filter((r) => r.accountId !== rank.accountId), rank];
      },
      onFearlessSeries: (payload) => {
        this.#fearlessBannedHeroIds = payload.bannedHeroIds;
      },
      onConnectionChange: (state) => {
        if (state === 'disconnected') {
          this.#live = false;
          this.#data = null;
        }
      }
    });
  }
}
