import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';

import type { GsiPayload } from './gsiListener.js';
import { getRequestPath, normalizePath, writeJson, writeNoContent } from './httpUtils.js';

export interface OverlayGsiEventStreamConfig {
  readonly host: string;
  readonly path?: string;
  readonly port: number;
}

export interface OverlayGsiEventStream {
  broadcast(payload: GsiPayload): void;
  getClientCount(): number;
  onClientCountChange(listener: (clientCount: number) => void): () => void;
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
  const clientCountListeners = new Set<(clientCount: number) => void>();

  let heartbeatTimer: NodeJS.Timeout | null = null;
  let server: Server | null = null;

  async function start(): Promise<void> {
    if (server !== null) {
      return;
    }

    const nextServer = createServer((request, response) => {
      handleRequest(request, response);
    });

    await new Promise<void>((resolve, reject) => {
      nextServer.once('error', reject);
      nextServer.listen(config.port, config.host, resolve);
    });

    server = nextServer;
    startHeartbeat();
  }

  async function stop(): Promise<void> {
    stopHeartbeat();

    for (const client of clients) {
      client.end();
    }

    clients.clear();
    emitClientCount();

    if (server === null) {
      return;
    }

    const activeServer = server;
    server = null;

    await new Promise<void>((resolve, reject) => {
      activeServer.close((error) => {
        if (error === undefined) {
          resolve();
          return;
        }

        reject(error);
      });
    });
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

    clients.add(response);
    emitClientCount();

    request.once('close', () => {
      clients.delete(response);
      emitClientCount();
    });
  }

  function broadcast(payload: GsiPayload): void {
    const message = `data: ${JSON.stringify(payload)}\n\n`;

    for (const client of clients) {
      if (client.destroyed) {
        clients.delete(client);
        continue;
      }

      client.write(message);
    }

    emitClientCount();
  }

  function startHeartbeat(): void {
    if (heartbeatTimer !== null) {
      return;
    }

    heartbeatTimer = setInterval(() => {
      for (const client of clients) {
        if (client.destroyed) {
          clients.delete(client);
          continue;
        }

        client.write(': heartbeat\n\n');
      }

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
    for (const listener of clientCountListeners) {
      try {
        listener(clients.size);
      } catch {
        // UI observers should not interrupt overlay streaming.
      }
    }
  }

  return {
    broadcast,
    getClientCount() {
      return clients.size;
    },
    onClientCountChange(listener) {
      clientCountListeners.add(listener);

      return () => {
        clientCountListeners.delete(listener);
      };
    },
    start,
    stop
  };
}

function getCrossOriginHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Origin': '*'
  };
}
