import { GSI_STATUS_EVENT } from '../shared/gsiStatus.js';
import { OVERLAY_REALTIME_EVENTS_URL } from '../shared/overlayEventStreamEndpoint.js';

// `disconnected` covers both a stale feed and an unreachable stream: the control
// window can see that data stopped, but not why.
export type GsiConnectionStatus = 'connected' | 'disconnected';

export class GsiStatusWatcher {
  #status = $state<GsiConnectionStatus>('disconnected');

  get status(): GsiConnectionStatus {
    return this.#status;
  }

  start(): () => void {
    // EventSource is unavailable during SSR / prerender.
    if (typeof EventSource === 'undefined') {
      return () => {};
    }

    const events = new EventSource(OVERLAY_REALTIME_EVENTS_URL);

    events.addEventListener(GSI_STATUS_EVENT, (event) => {
      const data = (event as MessageEvent<string>).data;
      this.#status = data === 'live' ? 'connected' : 'disconnected';
    });

    events.onerror = () => {
      this.#status = 'disconnected';
    };

    return () => {
      events.close();
    };
  }
}
