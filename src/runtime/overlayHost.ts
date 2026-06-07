import { createServer, type Server } from 'node:http';

export interface OverlayHostConfig {
  readonly host: string;
  readonly port: number;
}

export interface OverlayHost {
  start(): Promise<void>;
  stop(): Promise<void>;
}

export function createOverlayHost(config: OverlayHostConfig): OverlayHost {
  let server: Server | null = null;

  async function start(): Promise<void> {
    if (server !== null) {
      return;
    }

    const nextServer = createServer((_request, response) => {
      response.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8'
      });
      response.end('<!doctype html><title>Overlay Host</title><body>Overlay host ready</body>');
    });

    await new Promise<void>((resolve, reject) => {
      nextServer.once('error', reject);
      nextServer.listen(config.port, config.host, resolve);
    });

    server = nextServer;
  }

  async function stop(): Promise<void> {
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

  return {
    start,
    stop
  };
}

