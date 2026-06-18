import type { DotaGsiData } from '../shared/dotaGsiPayload.js';
import { GSI_STATUS_EVENT } from '../shared/gsiStatus.js';
import { logWarning } from '../shared/logger.js';
import { OVERLAY_REALTIME_EVENTS_URL } from '../shared/overlayEventStreamEndpoint.js';

// Latest live GSI payload from the realtime stream, for the studio preview's "Live" mode.
// Mirrors the standalone overlay's subscription (overlay.ts) but keeps the payload as reactive
// state instead of pushing it straight into a stage.
export class GsiFeed {
  #data = $state<DotaGsiData | null>(null);
  #live = $state(false);

  // Latest payload while the feed is live, or null when the stream is stale/disconnected.
  get data(): DotaGsiData | null {
    return this.#data;
  }

  get live(): boolean {
    return this.#live;
  }

  start(): () => void {
    // EventSource is unavailable during SSR / prerender.
    if (typeof EventSource === 'undefined') {
      return () => {};
    }

    const events = new EventSource(OVERLAY_REALTIME_EVENTS_URL);

    events.onmessage = (event) => {
      const gsiData = parseGsiPayload(event.data);

      if (gsiData !== null) {
        this.#data = gsiData;
      }
    };

    events.addEventListener(GSI_STATUS_EVENT, (event) => {
      this.#live = (event as MessageEvent<string>).data === 'live';

      // Stale feed: drop the payload so the preview clears instead of freezing on old state.
      if (!this.#live) {
        this.#data = null;
      }
    });

    events.onerror = () => {
      this.#live = false;
      this.#data = null;
    };

    return () => {
      events.close();
    };
  }
}

function parseGsiPayload(data: string): DotaGsiData | null {
  try {
    return JSON.parse(data) as DotaGsiData;
  } catch (error) {
    logWarning('Discarded malformed GSI payload', error);
    return null;
  }
}
