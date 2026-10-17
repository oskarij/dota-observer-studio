import { resolveOverlayAssetPath } from '../shared/overlayRoutes.js';
import { getRequestPath } from './httpUtils.js';
import { createManagedHttpServer } from './httpServer.js';
import { createMediaFileHandler } from './mediaFiles.js';
import type { OverlayGsiEventStream } from './overlayGsiEventStream.js';
import { createStaticFileHandler } from './staticFiles.js';

export interface OverlayHostConfig {
  readonly assetRoot: string;
  readonly host: string;
  readonly port: number;
  // Serves the realtime SSE feed on /events alongside the overlay assets, same-origin.
  readonly eventStream: OverlayGsiEventStream;
  // When set, user media (team logos) under this directory is served at /media/, same-origin.
  readonly mediaRoot?: string;
}

export interface OverlayHost {
  start(): Promise<void>;
  stop(): Promise<void>;
}

// Serves the built overlay bundle under /overlay/ over loopback HTTP for the OBS browser sources: one
// page per phase plus the bare route, all mapped onto the bundle by overlayRoutes.ts.
export function createOverlayHost(config: OverlayHostConfig): OverlayHost {
  const handle = createStaticFileHandler({
    assetRoot: config.assetRoot,
    address: config,
    resolveAssetPath: resolveOverlayAssetPath,
    cacheControl: (assetPath) =>
      assetPath.startsWith('assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
    connectEvents: config.eventStream.connect,
    notFoundMessage: 'Overlay route not found',
    readErrorMessage: 'Unable to read overlay asset'
  });
  const handleMedia =
    config.mediaRoot === undefined ? null : createMediaFileHandler(config.mediaRoot, config);

  const httpServer = createManagedHttpServer({
    host: config.host,
    port: config.port,
    onRequest(request, response) {
      if (handleMedia !== null && getRequestPath(request, config).startsWith('/media/')) {
        void handleMedia(request, response);
        return;
      }
      void handle(request, response);
    }
  });

  return {
    start: httpServer.start,
    stop: httpServer.stop
  };
}
