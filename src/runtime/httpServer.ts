import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

export interface ManagedHttpServerConfig {
  readonly host: string;
  // 0 lets the OS pick a free port; read it back with address().
  readonly port: number;
  readonly onRequest: (request: IncomingMessage, response: ServerResponse) => void;
  // Synchronous cleanup run before the socket closes, even if the server never started.
  readonly onBeforeClose?: () => void;
}

export interface ManagedHttpServer {
  start(): Promise<void>;
  stop(): Promise<void>;
  address(): AddressInfo | null;
}

// Idempotent start/stop. stop() destroys keep-alive sockets, so the port frees immediately.
export function createManagedHttpServer(config: ManagedHttpServerConfig): ManagedHttpServer {
  let server: Server | null = null;
  let starting: Promise<void> | null = null;
  let stopping: Promise<void> | null = null;

  function start(): Promise<void> {
    if (stopping !== null) return stopping.then(start);
    if (starting !== null) return starting;
    if (server !== null) return Promise.resolve();
    const nextServer = createServer(config.onRequest);
    server = nextServer;
    starting = new Promise<void>((resolve, reject) => {
      nextServer.once('error', reject);
      nextServer.listen(config.port, config.host, resolve);
    })
      .catch((error: unknown) => {
        server = null;
        throw error;
      })
      .finally(() => {
        starting = null;
      });
    return starting;
  }

  function stop(): Promise<void> {
    if (stopping !== null) return stopping;
    stopping = (async () => {
      await starting?.catch(() => {});
      config.onBeforeClose?.();
      if (server === null) return;
      const activeServer = server;
      server = null;
      const closed = new Promise<void>((resolve, reject) => {
        activeServer.close((error) => (error === undefined ? resolve() : reject(error)));
      });
      activeServer.closeAllConnections();
      await closed;
    })().finally(() => {
      stopping = null;
    });
    return stopping;
  }

  function address(): AddressInfo | null {
    const bound = server?.address();
    // A net Server bound to host:port returns an AddressInfo object (a string only for pipes/sockets).
    return bound !== null && typeof bound === 'object' ? bound : null;
  }

  return {
    start,
    stop,
    address
  };
}
