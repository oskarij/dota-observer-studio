import { connectOverlayRealtime } from '../overlay/overlayRealtimeClient.js';
import type { GsiStatus } from '../shared/gsiStatus.js';

// `disconnected` covers both a stale feed and an unreachable stream: the control
// window can see that data stopped, but not why. `outdated`: Dota sends updates the app rejects.
export type GsiConnectionStatus = 'connected' | 'disconnected' | 'outdated';

const CONNECTION_STATUS: Record<GsiStatus, GsiConnectionStatus> = {
  live: 'connected',
  stale: 'disconnected',
  rejected: 'outdated'
};

export class GsiStatusWatcher {
  #status = $state<GsiConnectionStatus>('disconnected');

  get status(): GsiConnectionStatus {
    return this.#status;
  }

  start(): () => void {
    return connectOverlayRealtime({
      onStatus: (status) => {
        this.#status = CONNECTION_STATUS[status];
      },
      onConnectionChange: (state) => {
        if (state === 'disconnected') {
          this.#status = 'disconnected';
        }
      }
    });
  }
}
