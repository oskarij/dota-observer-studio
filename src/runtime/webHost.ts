import { extname } from 'node:path';

import { createManagedHttpServer } from './httpServer.js';
import { createStaticFileHandler } from './staticFiles.js';

export interface WebHostConfig {
  readonly assetRoot: string;
  readonly host: string;
  // Pass 0 to bind an OS-assigned free port (collision-proof); read the real one back via port().
  readonly port: number;
}

export interface WebHost {
  start(): Promise<void>;
  stop(): Promise<void>;
  // The actual bound port once started, else null.
  port(): number | null;
}

// Serves the packaged studio UI (the SvelteKit static build) over loopback HTTP so the main window
// loads it from an http:// origin instead of file://. file:// breaks the build's absolute asset
// URLs (/_app/...) and the client router's History API navigation, which is the white-screen cause.
export function createWebHost(config: WebHostConfig): WebHost {
  const handle = createStaticFileHandler({
    assetRoot: config.assetRoot,
    address: config,
    resolveAssetPath: (requestPath) =>
      requestPath === '/' ? 'index.html' : requestPath.replace(/^\/+/, ''),
    // Everything under _app/immutable is content-hashed, so cache it forever; anything else
    // (index.html, top-level images) must revalidate so a rebuild is picked up.
    cacheControl: (assetPath) =>
      assetPath.includes('immutable') ? 'public, max-age=31536000, immutable' : 'no-cache',
    // A missing route with no file extension is an SPA navigation; hand it index.html and let the
    // client router take over. A missing hashed asset (has an extension) is a real 404.
    fallbackOnMissing: (requestPath) => (extname(requestPath) === '' ? 'index.html' : null),
    notFoundMessage: 'Studio route not found',
    readErrorMessage: 'Unable to read studio asset'
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
    stop: httpServer.stop,
    port: () => httpServer.address()?.port ?? null
  };
}
