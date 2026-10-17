import type { IncomingMessage, ServerResponse } from 'node:http';

import type { OverlayConfig } from '../shared/componentSettings.js';
import type { FearlessSeriesPayload } from '../shared/fearlessDraft.js';
import type { GsiStatus } from '../shared/gsiStatus.js';
import type { KnownPlayer } from '../shared/knownPlayer.js';
import {
  GSI_STATUS_EVENT,
  OVERLAY_FEARLESS_EVENT,
  OVERLAY_KNOWN_PLAYERS_EVENT,
  OVERLAY_PLAYER_RANK_EVENT,
  OVERLAY_SERIES_EVENT,
  OVERLAY_SETTINGS_EVENT,
  type PlayerRank
} from '../shared/overlayEvents.js';
import { projectOverlayPayload } from '../shared/overlayPayload.js';
import type { SeriesStatePayload } from '../shared/seriesState.js';
import type { GsiPayload } from './gsiListener.js';

// SSE fan-out for overlay clients. It owns no socket: each host routes GET /events here, so it
// survives a port rebind.
export interface OverlayGsiEventStream {
  connect(request: IncomingMessage, response: ServerResponse): void;
  broadcast(payload: GsiPayload): void;
  getClientCount(): number;
  // The latest value pushed through each setter is replayed to clients that connect later.
  setPlayerRank(rank: PlayerRank): void;
  setKnownPlayers(players: readonly KnownPlayer[]): void;
  setFearlessSeries(payload: FearlessSeriesPayload): void;
  setSeriesState(payload: SeriesStatePayload): void;
  setSettings(config: OverlayConfig): void;
  setStatus(status: GsiStatus): void;
  start(): void;
  stop(): void;
}

const HEARTBEAT_INTERVAL_MS = 15_000;

export function createOverlayGsiEventStream(): OverlayGsiEventStream {
  const clients = new Set<ServerResponse>();
  const statusOnlyClients = new Set<ServerResponse>();

  let currentStatus: GsiStatus = 'stale';
  let currentSettings: OverlayConfig | null = null;
  let currentKnownPlayers: readonly KnownPlayer[] | null = null;
  let currentFearlessSeries: FearlessSeriesPayload | null = null;
  let currentSeriesState: SeriesStatePayload | null = null;
  const playerRanks = new Map<string, PlayerRank>();
  let heartbeatTimer: NodeJS.Timeout | null = null;
  let latestPayload: GsiPayload | null = null;
  let latestPayloadEvent: string | null = null;

  function payloadEvent(): string | null {
    if (latestPayloadEvent === null && latestPayload !== null) {
      latestPayloadEvent = `data: ${JSON.stringify(projectOverlayPayload(latestPayload))}\n\n`;
    }
    return latestPayloadEvent;
  }

  function connect(request: IncomingMessage, response: ServerResponse): void {
    const statusOnly =
      new URL(request.url ?? '/', 'http://localhost').searchParams.get('statusOnly') === '1';
    response.writeHead(200, {
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Content-Type': 'text/event-stream; charset=utf-8'
    });
    response.write(': connected\n\n');
    // Sync newly connected clients to the current feed liveness and saved settings immediately.
    response.write(formatStatusEvent(currentStatus));
    if (!statusOnly && currentSettings !== null) {
      response.write(formatSettingsEvent(currentSettings));
    }
    if (!statusOnly && currentKnownPlayers !== null) {
      response.write(formatKnownPlayersEvent(currentKnownPlayers));
    }
    if (!statusOnly && currentFearlessSeries !== null) {
      response.write(formatFearlessEvent(currentFearlessSeries));
    }
    if (!statusOnly && currentSeriesState !== null) {
      response.write(formatSeriesEvent(currentSeriesState));
    }
    if (!statusOnly) {
      for (const rank of playerRanks.values()) response.write(formatPlayerRankEvent(rank));
      const event = payloadEvent();
      if (event !== null) response.write(event);
    }

    clients.add(response);
    if (statusOnly) statusOnlyClients.add(response);

    request.once('close', () => {
      clients.delete(response);
      statusOnlyClients.delete(response);
    });
  }

  function broadcast(payload: GsiPayload): void {
    latestPayload = payload;
    // Retain a snapshot for reconnects, but do no serialization when nobody needs game data.
    if (clients.size === statusOnlyClients.size) {
      latestPayloadEvent = null;
      return;
    }
    const event = `data: ${JSON.stringify(projectOverlayPayload(payload))}\n\n`;
    if (event === latestPayloadEvent) return;
    latestPayloadEvent = event;
    writeToClients(event);
  }

  function setPlayerRank(rank: PlayerRank): void {
    playerRanks.set(rank.accountId, rank);
    writeToClients(formatPlayerRankEvent(rank));
  }

  function setKnownPlayers(players: readonly KnownPlayer[]): void {
    currentKnownPlayers = players;
    writeToClients(formatKnownPlayersEvent(players));
  }

  function setFearlessSeries(payload: FearlessSeriesPayload): void {
    currentFearlessSeries = payload;
    writeToClients(formatFearlessEvent(payload));
  }

  function setSeriesState(payload: SeriesStatePayload): void {
    currentSeriesState = payload;
    writeToClients(formatSeriesEvent(payload));
  }

  function setSettings(settings: OverlayConfig): void {
    currentSettings = settings;
    writeToClients(formatSettingsEvent(settings));
  }

  function setStatus(status: GsiStatus): void {
    if (status === currentStatus) {
      return;
    }

    currentStatus = status;
    if (status === 'stale') {
      latestPayload = null;
      latestPayloadEvent = null;
    }
    writeToAliveClients(formatStatusEvent(status), true);
  }

  function writeToClients(message: string): void {
    writeToAliveClients(message);
  }

  // Prunes any client that has disconnected since the last write.
  function writeToAliveClients(message: string, includeStatusOnly = false): void {
    for (const client of clients) {
      if (client.destroyed) {
        clients.delete(client);
        statusOnlyClients.delete(client);
        continue;
      }

      if (!includeStatusOnly && statusOnlyClients.has(client)) continue;
      // A minimized or disconnected reader must never build an unbounded queue in main.
      // EventSource reconnects and receives the latest state instead of minutes of old updates.
      if (client.writableLength > 256 * 1024) {
        clients.delete(client);
        statusOnlyClients.delete(client);
        client.destroy();
      } else {
        client.write(message);
      }
    }
  }

  function startHeartbeat(): void {
    if (heartbeatTimer !== null) {
      return;
    }

    heartbeatTimer = setInterval(() => {
      writeToAliveClients(': heartbeat\n\n', true);
    }, HEARTBEAT_INTERVAL_MS);
    heartbeatTimer.unref();
  }

  function stopHeartbeat(): void {
    if (heartbeatTimer === null) {
      return;
    }

    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }

  return {
    connect,
    broadcast,
    getClientCount() {
      return clients.size;
    },
    setKnownPlayers,
    setFearlessSeries,
    setSeriesState,
    setPlayerRank,
    setSettings,
    setStatus,
    start: startHeartbeat,
    stop() {
      // SSE clients are long-lived; end() is graceful, so drain them when the app shuts down.
      stopHeartbeat();
      for (const client of clients) {
        client.end();
      }
      clients.clear();
      statusOnlyClients.clear();
      latestPayload = null;
      latestPayloadEvent = null;
    }
  };
}

function formatStatusEvent(status: GsiStatus): string {
  return `event: ${GSI_STATUS_EVENT}\ndata: ${status}\n\n`;
}

function formatSettingsEvent(config: OverlayConfig): string {
  return `event: ${OVERLAY_SETTINGS_EVENT}\ndata: ${JSON.stringify(config)}\n\n`;
}

function formatKnownPlayersEvent(players: readonly KnownPlayer[]): string {
  return `event: ${OVERLAY_KNOWN_PLAYERS_EVENT}\ndata: ${JSON.stringify(players)}\n\n`;
}

function formatFearlessEvent(payload: FearlessSeriesPayload): string {
  return `event: ${OVERLAY_FEARLESS_EVENT}\ndata: ${JSON.stringify(payload)}\n\n`;
}

function formatSeriesEvent(payload: SeriesStatePayload): string {
  return `event: ${OVERLAY_SERIES_EVENT}\ndata: ${JSON.stringify(payload)}\n\n`;
}

function formatPlayerRankEvent(rank: PlayerRank): string {
  return `event: ${OVERLAY_PLAYER_RANK_EVENT}\ndata: ${JSON.stringify(rank)}\n\n`;
}
