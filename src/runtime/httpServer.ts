import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

export interface ManagedHttpServerConfig {
  readonly host: string;
  // Port to bind. Pass 0 to let the OS assign a free ephemeral port; read it back via address().
  readonly port: number;
  readonly onRequest: (request: IncomingMessage, response: ServerResponse) => void;
  // Synchronous cleanup run before the socket closes, even if the server never started.
  readonly onBeforeClose?: () => void;
}

export interface ManagedHttpServer {
  start(): Promise<void>;
  stop(): Promise<void>;
  // The bound address once started (notably the real port when port 0 was requested), else null.
  address(): AddressInfo | null;
}

// Encapsulates the listen/close lifecycle shared by every runtime HTTP server: idempotent
// start/stop, and a stop that destroys keep-alive sockets so the port frees immediately.
export function createManagedHttpServer(config: ManagedHttpServerConfig): ManagedHttpServer {
  let server: Server | null = null;

  async function start(): Promise<void> {
    if (server !== null) {
      return;
    }

    const nextServer = createServer(config.onRequest);

    await new Promise<void>((resolve, reject) => {
      nextServer.once('error', reject);
      nextServer.listen(config.port, config.host, resolve);
    });

    server = nextServer;
  }

  async function stop(): Promise<void> {
    config.onBeforeClose?.();

    if (server === null) {
      return;
    }

    const activeServer = server;
    server = null;

    // close() alone waits for idle keep-alive sockets to drain; destroy them so the port frees now.
    activeServer.closeAllConnections();

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
