import type { OverlayConfig } from '../shared/componentSettings.js';
import type { DotaGsiData } from '../shared/dotaGsiPayload.js';
import { GSI_STATUS_EVENT, type GsiStatus } from '../shared/gsiStatus.js';
import { logWarning } from '../shared/logger.js';
import { OVERLAY_REALTIME_EVENTS_URL } from '../shared/overlayEventStreamEndpoint.js';
import { OVERLAY_PLAYER_RANK_EVENT, type PlayerRank } from '../shared/overlayPlayerRankEvent.js';
import { OVERLAY_SETTINGS_EVENT } from '../shared/overlaySettingsEvent.js';

export type RealtimeConnectionState = 'connected' | 'disconnected';

// One place that decodes the overlay's realtime SSE stream into typed callbacks. Both the
// standalone overlay (overlay.ts) and the studio preview feed (gsiFeed.svelte.ts) subscribe
// through this, so a new event type is wired here once instead of drifting between consumers.
// Each handler is optional; what a consumer does with the data (push to a stage, hold reactive
// state, …) stays its own concern.
export interface OverlayRealtimeHandlers {
  onGsiData?(data: DotaGsiData): void;
  onStatus?(status: GsiStatus): void;
  onSettings?(config: OverlayConfig): void;
  onPlayerRank?(rank: PlayerRank): void;
  onConnectionChange?(state: RealtimeConnectionState): void;
}

/** Subscribe to the realtime stream. Returns a disposer that closes the connection. */
export function connectOverlayRealtime(handlers: OverlayRealtimeHandlers): () => void {
  // EventSource is unavailable during SSR / prerender.
  if (typeof EventSource === 'undefined') {
    return () => {};
  }

  const events = new EventSource(OVERLAY_REALTIME_EVENTS_URL);

  events.onmessage = (event) => {
    const gsiData = parse<DotaGsiData>(event.data, 'GSI payload');

    if (gsiData !== null) {
      handlers.onGsiData?.(gsiData);
    }
  };

  events.addEventListener(GSI_STATUS_EVENT, (event) => {
    const status: GsiStatus = event.data === 'live' ? 'live' : 'stale';
    handlers.onStatus?.(status);
  });

  events.addEventListener(OVERLAY_SETTINGS_EVENT, (event) => {
    const config = parse<OverlayConfig>(event.data, 'overlay settings');

    if (config !== null) {
      handlers.onSettings?.(config);
    }
  });

  events.addEventListener(OVERLAY_PLAYER_RANK_EVENT, (event) => {
    const rank = parse<PlayerRank>(event.data, 'player rank');

    if (rank !== null) {
      handlers.onPlayerRank?.(rank);
    }
  });

  events.onopen = () => {
    handlers.onConnectionChange?.('connected');
  };

  events.onerror = () => {
    handlers.onConnectionChange?.('disconnected');
  };

  return () => {
    events.close();
  };
}

function parse<T>(data: string, label: string): T | null {
  try {
    return JSON.parse(data) as T;
  } catch (error) {
    logWarning(`Discarded malformed ${label} payload`, error);
    return null;
  }
}
