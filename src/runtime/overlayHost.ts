import { readFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { extname, isAbsolute, join, relative } from 'node:path';

import { createManagedHttpServer } from './httpServer.js';
import { getRequestPath, writeJson } from './httpUtils.js';

export interface OverlayHostConfig {
  readonly assetRoot: string;
  readonly host: string;
  readonly port: number;
}

export interface OverlayHost {
  start(): Promise<void>;
  stop(): Promise<void>;
}

export function createOverlayHost(config: OverlayHostConfig): OverlayHost {
  const httpServer = createManagedHttpServer({
    host: config.host,
    port: config.port,
    onRequest(request, response) {
      void handleRequest(request, response);
    }
  });

  return {
    start: httpServer.start,
    stop: httpServer.stop
  };

  async function handleRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const method = request.method?.toUpperCase() ?? 'GET';
    const path = getRequestPath(request, config);

    if (method !== 'GET') {
      writeNotFound(response);
      return;
    }

    const overlayAsset = getOverlayAsset(path, config.assetRoot);

    if (overlayAsset === null) {
      writeNotFound(response);
      return;
    }

    try {
      const content = await readFile(overlayAsset.path);

      response.writeHead(200, {
        'Cache-Control': getCacheControl(overlayAsset.assetPath),
        'Content-Type': getContentType(overlayAsset.path)
      });
      response.end(content);
    } catch (error) {
      if (isNodeFileError(error) && error.code === 'ENOENT') {
        writeNotFound(response);
        return;
      }

      writeJson(response, 500, {
        error: 'Unable to read overlay asset'
      });
    }
  }
}

interface OverlayAsset {
  readonly assetPath: string;
  readonly path: string;
}

function getOverlayAsset(requestPath: string, assetRoot: string): OverlayAsset | null {
  const assetPath = getOverlayAssetPath(requestPath);

  if (assetPath === null) {
    return null;
  }

  const resolvedPath = join(assetRoot, assetPath);
  const relativePath = relative(assetRoot, resolvedPath);

  if (relativePath.startsWith('..') || isAbsolute(relativePath)) {
    return null;
  }

  return {
    assetPath,
    path: resolvedPath
  };
}

function decodeAssetPath(assetPath: string): string | null {
  try {
    const decodedPath = decodeURIComponent(assetPath);

    return decodedPath.length === 0 ? 'index.html' : decodedPath;
  } catch {
    return null;
  }
}

function getOverlayAssetPath(requestPath: string): string | null {
  if (requestPath === '/overlay' || requestPath === '/overlay/') {
    return 'index.html';
  }

  if (!requestPath.startsWith('/overlay/')) {
    return null;
  }

  return decodeAssetPath(requestPath.slice('/overlay/'.length));
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
      return 'application/json; charset=utf-8';
    case '.map':
      return 'application/json; charset=utf-8';
    case '.png':
      return 'image/png';
    case '.svg':
      return 'image/svg+xml';
    case '.webp':
      return 'image/webp';
    default:
      return 'application/octet-stream';
  }
}

function getCacheControl(assetPath: string): string {
  if (assetPath === 'index.html') {
    return 'no-cache';
  }

  if (assetPath.startsWith('assets/')) {
    return 'public, max-age=31536000, immutable';
  }

  return 'no-cache';
}

function isNodeFileError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}

function writeNotFound(response: ServerResponse): void {
  writeJson(response, 404, {
    error: 'Overlay route not found'
  });
}
