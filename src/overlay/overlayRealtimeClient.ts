import { mergeOverlayConfigDefaults, type OverlayConfig } from '../shared/componentSettings.js';
import type { DotaGsiData } from '../shared/dotaGsiPayload.js';
import type { FearlessSeriesPayload } from '../shared/fearlessDraft.js';
import { GSI_STATUS_EVENT, type GsiStatus } from '../shared/gsiStatus.js';
import type { KnownPlayer } from '../shared/knownPlayer.js';
import { logWarning } from '../shared/logger.js';
import { OVERLAY_EVENTS_PATH } from '../shared/networkConfig.js';
import { OVERLAY_FEARLESS_EVENT } from '../shared/overlayFearlessEvent.js';
import { OVERLAY_KNOWN_PLAYERS_EVENT } from '../shared/overlayKnownPlayersEvent.js';
import { OVERLAY_PLAYER_RANK_EVENT, type PlayerRank } from '../shared/overlayPlayerRankEvent.js';
import { OVERLAY_SERIES_EVENT } from '../shared/overlaySeriesEvent.js';
import { OVERLAY_SETTINGS_EVENT } from '../shared/overlaySettingsEvent.js';
import type { SeriesStatePayload } from '../shared/seriesState.js';

export type RealtimeConnectionState = 'connected' | 'disconnected';

// Single SSE decoder shared by overlay.ts and the studio preview (gsiFeed.svelte.ts), so a new
// event type is wired here once instead of drifting between consumers. Handlers are optional.
export interface OverlayRealtimeHandlers {
  onGsiData?(data: DotaGsiData): void;
  onStatus?(status: GsiStatus): void;
  onSettings?(config: OverlayConfig): void;
  onKnownPlayers?(players: KnownPlayer[]): void;
  onFearlessSeries?(payload: FearlessSeriesPayload): void;
  onSeriesState?(payload: SeriesStatePayload): void;
  onPlayerRank?(rank: PlayerRank): void;
  onConnectionChange?(state: RealtimeConnectionState): void;
}

export function connectOverlayRealtime(handlers: OverlayRealtimeHandlers): () => void {
  // EventSource is unavailable during SSR / prerender.
  if (typeof EventSource === 'undefined') {
    return () => {};
  }

  // The /events SSE route is served on the same origin that served this page (the overlay host, or
  // the web host for the studio preview), so it works over loopback or a LAN address with no CORS.
  const statusOnly =
    !handlers.onGsiData &&
    !handlers.onSettings &&
    !handlers.onKnownPlayers &&
    !handlers.onFearlessSeries &&
    !handlers.onSeriesState &&
    !handlers.onPlayerRank;
  const events = new EventSource(
    `${window.location.origin}${OVERLAY_EVENTS_PATH}${statusOnly ? '?statusOnly=1' : ''}`
  );

  events.onmessage = (event) => {
    if (handlers.onGsiData === undefined) return;
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
    const config = parse<unknown>(event.data, 'overlay settings');

    try {
      handlers.onSettings?.(mergeOverlayConfigDefaults(config));
    } catch {
      // Keep the last valid settings when an event is malformed.
    }
  });

  events.addEventListener(OVERLAY_KNOWN_PLAYERS_EVENT, (event) => {
    const players = parse<KnownPlayer[]>(event.data, 'known players');

    if (Array.isArray(players)) {
      handlers.onKnownPlayers?.(players);
    }
  });

  events.addEventListener(OVERLAY_FEARLESS_EVENT, (event) => {
    const payload = parse<FearlessSeriesPayload>(event.data, 'fearless series');

    if (payload !== null && Array.isArray(payload.bannedHeroIds)) {
      handlers.onFearlessSeries?.(payload);
    }
  });

  events.addEventListener(OVERLAY_SERIES_EVENT, (event) => {
    const payload = parse<SeriesStatePayload>(event.data, 'series state');

    // typeof null is 'object', so the null checks are load-bearing: a malformed side would throw
    // inside every consumer render.
    if (
      payload !== null &&
      typeof payload.radiant === 'object' &&
      payload.radiant !== null &&
      typeof payload.dire === 'object' &&
      payload.dire !== null
    ) {
      handlers.onSeriesState?.(payload);
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
