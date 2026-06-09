// Single source of truth for the loopback host and ports the runtime servers bind to.
// Consumed by the Electron main process, the overlay event-stream endpoint, and the control UI.
export const NETWORK_HOST = '127.0.0.1';

export const NETWORK_PORTS = {
  overlayHost: 3333,
  gsiListener: 3334,
  overlayEventStream: 3335
} as const;
