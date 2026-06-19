import { readFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { extname, isAbsolute, join, relative } from 'node:path';

import { createManagedHttpServer } from './httpServer.js';
import { getRequestPath, writeJson } from './httpUtils.js';

export interface WebHostConfig {
  readonly assetRoot: string;
  readonly host: string;
  /** Pass 0 to bind an OS-assigned free port (collision-proof); read the real one back via port(). */
  readonly port: number;
}

export interface WebHost {
  start(): Promise<void>;
  stop(): Promise<void>;
  /** The actual bound port once started, else null. */
  port(): number | null;
}

// Serves the packaged studio UI (the SvelteKit static build) over loopback HTTP so the main window
// loads it from an http:// origin instead of file://. file:// breaks the build's absolute asset
// URLs (/_app/...) and the client router's History API navigation, which is the white-screen cause.
export function createWebHost(config: WebHostConfig): WebHost {
  const httpServer = createManagedHttpServer({
    host: config.host,
    port: config.port,
    onRequest(request, response) {
      void handleRequest(request, response);
    }
  });

  return {
    start: httpServer.start,
    stop: httpServer.stop,
    port: () => httpServer.address()?.port ?? null
  };

  async function handleRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
    if ((request.method?.toUpperCase() ?? 'GET') !== 'GET') {
      writeNotFound(response);
      return;
    }

    const requestPath = getRequestPath(request, config);
    const filePath = resolveFilePath(requestPath, config.assetRoot);

    if (filePath === null) {
      writeNotFound(response);
      return;
    }

    try {
      await serveFile(filePath, response);
    } catch (error) {
      if (isNodeFileError(error) && error.code === 'ENOENT') {
        // A missing asset (a hashed /_app file) is a real 404; a missing *route* (no file extension)
        // is an SPA navigation, so hand it index.html and let the client router take over.
        if (extname(requestPath) === '') {
          await serveIndex(config.assetRoot, response);
          return;
        }

        writeNotFound(response);
        return;
      }

      writeJson(response, 500, { error: 'Unable to read studio asset' });
    }
  }
}

// Maps a request path to an on-disk file inside assetRoot, or null if it would escape the root.
function resolveFilePath(requestPath: string, assetRoot: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(requestPath);
  } catch {
    return null;
  }

  const relativeAsset = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '');
  const resolvedPath = join(assetRoot, relativeAsset);
  const relativePath = relative(assetRoot, resolvedPath);

  if (relativePath.startsWith('..') || isAbsolute(relativePath)) {
    return null;
  }

  return resolvedPath;
}

async function serveIndex(assetRoot: string, response: ServerResponse): Promise<void> {
  await serveFile(join(assetRoot, 'index.html'), response);
}

async function serveFile(filePath: string, response: ServerResponse): Promise<void> {
  const content = await readFile(filePath);

  response.writeHead(200, {
    'Cache-Control': getCacheControl(filePath),
    'Content-Type': getContentType(filePath)
  });
  response.end(content);
}

function getContentType(path: string): string {
  switch (extname(path)) {
    case '.css':
      return 'text/css; charset=utf-8';
    case '.html':
      return 'text/html; charset=utf-8';
    case '.js':
      return 'text/javascript; charset=utf-8';
    case '.json':
    case '.map':
      return 'application/json; charset=utf-8';
    case '.ico':
      return 'image/x-icon';
    case '.png':
      return 'image/png';
    case '.svg':
      return 'image/svg+xml';
    case '.webp':
      return 'image/webp';
    case '.otf':
      return 'font/otf';
    case '.ttf':
      return 'font/ttf';
    case '.woff':
      return 'font/woff';
    case '.woff2':
      return 'font/woff2';
    default:
      return 'application/octet-stream';
  }
}

function getCacheControl(filePath: string): string {
  // Everything under _app/immutable is content-hashed, so it can be cached forever; anything else
  // (index.html, top-level images) must revalidate so a rebuild is picked up.
  return filePath.includes('immutable') ? 'public, max-age=31536000, immutable' : 'no-cache';
}

function isNodeFileError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}

function writeNotFound(response: ServerResponse): void {
  writeJson(response, 404, { error: 'Studio route not found' });
}
