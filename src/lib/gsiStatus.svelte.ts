import { connectOverlayRealtime } from '../overlay/overlayRealtimeClient.js';

// `disconnected` covers both a stale feed and an unreachable stream: the control
// window can see that data stopped, but not why.
export type GsiConnectionStatus = 'connected' | 'disconnected';

export class GsiStatusWatcher {
  #status = $state<GsiConnectionStatus>('disconnected');

  get status(): GsiConnectionStatus {
    return this.#status;
  }

  start(): () => void {
    // Routed through the shared SSE decoder so this watcher follows the same connection contract as
    // the overlay and the preview feed instead of opening its own raw EventSource.
    return connectOverlayRealtime({
      onStatus: (status) => {
        this.#status = status === 'live' ? 'connected' : 'disconnected';
      },
      onConnectionChange: (state) => {
        if (state === 'disconnected') {
          this.#status = 'disconnected';
        }
      }
    });
  }
}
