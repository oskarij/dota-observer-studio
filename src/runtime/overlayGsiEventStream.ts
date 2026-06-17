import type { IncomingMessage, ServerResponse } from 'node:http';

import type { OverlayConfig } from '../shared/componentSettings.js';
import { GSI_STATUS_EVENT, type GsiStatus } from '../shared/gsiStatus.js';
import { OVERLAY_SETTINGS_EVENT } from '../shared/overlaySettingsEvent.js';
import type { GsiPayload } from './gsiListener.js';
import { createManagedHttpServer } from './httpServer.js';
import { getRequestPath, normalizePath, writeJson, writeNoContent } from './httpUtils.js';
import { createObservers } from './observers.js';

export interface OverlayGsiEventStreamConfig {
  readonly host: string;
  readonly path?: string;
  readonly port: number;
}

export interface OverlayGsiEventStream {
  broadcast(payload: GsiPayload): void;
  getClientCount(): number;
  onClientCountChange(listener: (clientCount: number) => void): () => void;
  /** Push overlay settings to every client. Replayed to clients that connect later. */
  setSettings(config: OverlayConfig): void;
  /** Push the GSI feed liveness to every client. Replayed to clients that connect later. */
  setStatus(status: GsiStatus): void;
  start(): Promise<void>;
  stop(): Promise<void>;
}

const DEFAULT_EVENTS_PATH = '/events';
const HEARTBEAT_INTERVAL_MS = 15_000;

export function createOverlayGsiEventStream(
  config: OverlayGsiEventStreamConfig
): OverlayGsiEventStream {
  const eventsPath = normalizePath(config.path ?? DEFAULT_EVENTS_PATH);
  const clients = new Set<ServerResponse>();
  const clientCountObservers = createObservers<number>('overlay client count');

  let currentStatus: GsiStatus = 'stale';
  let currentSettings: OverlayConfig | null = null;
  let heartbeatTimer: NodeJS.Timeout | null = null;

  const httpServer = createManagedHttpServer({
    host: config.host,
    port: config.port,
    onRequest: handleRequest,
    // SSE clients are long-lived; client.end() is graceful, so the factory destroys any stragglers.
    onBeforeClose() {
      stopHeartbeat();

      for (const client of clients) {
        client.end();
      }

      clients.clear();
      emitClientCount();
    }
  });

  async function start(): Promise<void> {
    await httpServer.start();
    startHeartbeat();
  }

  function handleRequest(request: IncomingMessage, response: ServerResponse): void {
    const method = request.method?.toUpperCase() ?? 'GET';
    const path = getRequestPath(request, config);

    if (method === 'OPTIONS') {
      writeNoContent(response, getCrossOriginHeaders());
      return;
    }

    if (method !== 'GET' || path !== eventsPath) {
      writeJson(
        response,
        404,
        {
          error: 'Overlay GSI event stream route not found'
        },
        getCrossOriginHeaders()
      );
      return;
    }

    connectClient(request, response);
  }

  function connectClient(request: IncomingMessage, response: ServerResponse): void {
    response.writeHead(200, {
      ...getCrossOriginHeaders(),
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

  // Write to every live client, pruning any that have disconnected since the last write.
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
    broadcast,
    getClientCount() {
      return clients.size;
    },
    onClientCountChange: clientCountObservers.add,
    setSettings,
    setStatus,
    start,
    stop: httpServer.stop
  };
}

function formatStatusEvent(status: GsiStatus): string {
  return `event: ${GSI_STATUS_EVENT}\ndata: ${status}\n\n`;
}

function formatSettingsEvent(config: OverlayConfig): string {
  return `event: ${OVERLAY_SETTINGS_EVENT}\ndata: ${JSON.stringify(config)}\n\n`;
}

function getCrossOriginHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Origin': '*'
  };
}
