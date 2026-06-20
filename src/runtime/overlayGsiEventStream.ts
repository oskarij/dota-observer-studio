import type { IncomingMessage, ServerResponse } from 'node:http';

import type { OverlayConfig } from '../shared/componentSettings.js';
import type { FearlessSeriesPayload } from '../shared/fearlessDraft.js';
import { GSI_STATUS_EVENT, type GsiStatus } from '../shared/gsiStatus.js';
import type { KnownPlayer } from '../shared/knownPlayer.js';
import { OVERLAY_FEARLESS_EVENT } from '../shared/overlayFearlessEvent.js';
import { OVERLAY_KNOWN_PLAYERS_EVENT } from '../shared/overlayKnownPlayersEvent.js';
import { OVERLAY_PLAYER_RANK_EVENT, type PlayerRank } from '../shared/overlayPlayerRankEvent.js';
import { OVERLAY_SETTINGS_EVENT } from '../shared/overlaySettingsEvent.js';
import type { GsiPayload } from './gsiListener.js';
import { createObservers } from './observers.js';

// The SSE fan-out hub for overlay clients. It owns no socket: the overlay host (and, in a packaged
// build, the web host) route GET /events here, so the live overlay and the studio preview each
// connect on their own origin without a dedicated port or CORS. It is a singleton that survives a
// host's port rebind.
export interface OverlayGsiEventStream {
  // Register a routed GET /events request as an SSE client.
  connect(request: IncomingMessage, response: ServerResponse): void;
  broadcast(payload: GsiPayload): void;
  getClientCount(): number;
  onClientCountChange(listener: (clientCount: number) => void): () => void;
  // The latest value pushed through each setter is replayed to clients that connect later.
  setPlayerRank(rank: PlayerRank): void;
  setKnownPlayers(players: readonly KnownPlayer[]): void;
  setFearlessSeries(payload: FearlessSeriesPayload): void;
  setSettings(config: OverlayConfig): void;
  setStatus(status: GsiStatus): void;
  start(): void;
  stop(): void;
}

const HEARTBEAT_INTERVAL_MS = 15_000;

export function createOverlayGsiEventStream(): OverlayGsiEventStream {
  const clients = new Set<ServerResponse>();
  const clientCountObservers = createObservers<number>('overlay client count');

  let currentStatus: GsiStatus = 'stale';
  let currentSettings: OverlayConfig | null = null;
  let currentKnownPlayers: readonly KnownPlayer[] | null = null;
  let currentFearlessSeries: FearlessSeriesPayload | null = null;
  // Every rank pushed this session, replayed to clients that connect after it was sent.
  const playerRanks = new Map<string, PlayerRank>();
  let heartbeatTimer: NodeJS.Timeout | null = null;

  function connect(request: IncomingMessage, response: ServerResponse): void {
    response.writeHead(200, {
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Content-Type': 'text/event-stream; charset=utf-8'
    });
    response.write(': connected\n\n');
    // Sync newly connected clients to the current feed liveness and saved settings immediately.
    response.write(formatStatusEvent(currentStatus));
    if (currentSettings !== null) {
      response.write(formatSettingsEvent(currentSettings));
    }
    if (currentKnownPlayers !== null) {
      response.write(formatKnownPlayersEvent(currentKnownPlayers));
    }
    if (currentFearlessSeries !== null) {
      response.write(formatFearlessEvent(currentFearlessSeries));
    }
    for (const rank of playerRanks.values()) {
      response.write(formatPlayerRankEvent(rank));
    }

    clients.add(response);
    emitClientCount();

    request.once('close', () => {
      clients.delete(response);
      emitClientCount();
    });
  }

  function broadcast(payload: GsiPayload): void {
    writeToClients(`data: ${JSON.stringify(payload)}\n\n`);
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

  function setSettings(settings: OverlayConfig): void {
    currentSettings = settings;
    writeToClients(formatSettingsEvent(settings));
  }

  function setStatus(status: GsiStatus): void {
    if (status === currentStatus) {
      return;
    }

    currentStatus = status;
    writeToClients(formatStatusEvent(status));
  }

  function writeToClients(message: string): void {
    writeToAliveClients(message);
    emitClientCount();
  }

  // Prunes any client that has disconnected since the last write.
  function writeToAliveClients(message: string): void {
    for (const client of clients) {
      if (client.destroyed) {
        clients.delete(client);
        continue;
      }

      client.write(message);
    }
  }

  function startHeartbeat(): void {
    if (heartbeatTimer !== null) {
      return;
    }

    heartbeatTimer = setInterval(() => {
      writeToAliveClients(': heartbeat\n\n');
      emitClientCount();
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

  function emitClientCount(): void {
    clientCountObservers.emit(clients.size);
  }

  return {
    connect,
    broadcast,
    getClientCount() {
      return clients.size;
    },
    onClientCountChange: clientCountObservers.add,
    setKnownPlayers,
    setFearlessSeries,
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
      emitClientCount();
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

function formatPlayerRankEvent(rank: PlayerRank): string {
  return `event: ${OVERLAY_PLAYER_RANK_EVENT}\ndata: ${JSON.stringify(rank)}\n\n`;
}
