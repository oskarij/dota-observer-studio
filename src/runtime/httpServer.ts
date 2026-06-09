import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';

export interface ManagedHttpServerConfig {
  readonly host: string;
  readonly port: number;
  readonly onRequest: (request: IncomingMessage, response: ServerResponse) => void;
  /** Synchronous cleanup run before the socket closes, even if the server never started. */
  readonly onBeforeClose?: () => void;
}

export interface ManagedHttpServer {
  start(): Promise<void>;
  stop(): Promise<void>;
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

  return {
    start,
    stop
  };
}
