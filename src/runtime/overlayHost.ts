import { createManagedHttpServer } from './httpServer.js';
import { createStaticFileHandler } from './staticFiles.js';

export interface OverlayHostConfig {
  readonly assetRoot: string;
  readonly host: string;
  readonly port: number;
}

export interface OverlayHost {
  start(): Promise<void>;
  stop(): Promise<void>;
}

// Serves the built overlay bundle under /overlay/ over loopback HTTP for the OBS browser source.
export function createOverlayHost(config: OverlayHostConfig): OverlayHost {
  const handle = createStaticFileHandler({
    assetRoot: config.assetRoot,
    address: config,
    resolveAssetPath: resolveOverlayAssetPath,
    cacheControl: (assetPath) =>
      assetPath.startsWith('assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
    notFoundMessage: 'Overlay route not found',
    readErrorMessage: 'Unable to read overlay asset'
  });

  const httpServer = createManagedHttpServer({
    host: config.host,
    port: config.port,
    onRequest(request, response) {
      void handle(request, response);
    }
  });

  return {
    start: httpServer.start,
    stop: httpServer.stop
  };
}

// Maps the /overlay/ prefix to the bundle; the bare path resolves to its index.
function resolveOverlayAssetPath(requestPath: string): string | null {
  if (requestPath === '/overlay' || requestPath === '/overlay/') {
    return 'index.html';
  }

  if (!requestPath.startsWith('/overlay/')) {
    return null;
  }

  const assetPath = requestPath.slice('/overlay/'.length);
  return assetPath.length === 0 ? 'index.html' : assetPath;
}
