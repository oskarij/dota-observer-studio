import { readFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { extname, isAbsolute, join, relative } from 'node:path';

import { getRequestPath, type HttpServerAddress, writeJson } from './httpUtils.js';

export interface StaticFileHandlerConfig {
  readonly assetRoot: string;
  readonly address: HttpServerAddress;
  // Map a normalized request path to a relative asset path under assetRoot, or null for a 404.
  resolveAssetPath(requestPath: string): string | null;
  cacheControl(assetPath: string): string;
  // Optional fallback asset when the resolved file is missing (e.g. an SPA index). Null = 404.
  fallbackOnMissing?(requestPath: string): string | null;
  readonly notFoundMessage: string;
  readonly readErrorMessage: string;
}

export type StaticFileHandler = (
  request: IncomingMessage,
  response: ServerResponse
) => Promise<void>;

// Serves files from one asset root; owns the GET guard, path-traversal guard, MIME table, and
// 404/500 handling so the security-sensitive traversal guard lives in one place. Each host
// supplies only path-mapping and cache policy.
export function createStaticFileHandler(config: StaticFileHandlerConfig): StaticFileHandler {
  return async function handle(request, response) {
    if ((request.method?.toUpperCase() ?? 'GET') !== 'GET') {
      writeNotFound(response, config.notFoundMessage);
      return;
    }

    const requestPath = getRequestPath(request, config.address);
    const assetPath = config.resolveAssetPath(requestPath);
    if (assetPath === null) {
      writeNotFound(response, config.notFoundMessage);
      return;
    }

    const filePath = resolveWithinRoot(config.assetRoot, assetPath);
    if (filePath === null) {
      writeNotFound(response, config.notFoundMessage);
      return;
    }

    try {
      await serveFile(filePath, config.cacheControl(assetPath), response);
    } catch (error) {
      if (isNodeFileError(error) && error.code === 'ENOENT') {
        const fallback = config.fallbackOnMissing?.(requestPath) ?? null;
        if (
          fallback !== null &&
          (await serveFallback(config.assetRoot, fallback, config, response))
        ) {
          return;
        }

        writeNotFound(response, config.notFoundMessage);
        return;
      }

      writeJson(response, 500, { error: config.readErrorMessage });
    }
  };
}

// Serve the SPA-index fallback for a missing route; false means the caller should 404.
async function serveFallback(
  assetRoot: string,
  fallback: string,
  config: StaticFileHandlerConfig,
  response: ServerResponse
): Promise<boolean> {
  const fallbackPath = resolveWithinRoot(assetRoot, fallback);
  if (fallbackPath === null) {
    return false;
  }

  try {
    await serveFile(fallbackPath, config.cacheControl(fallback), response);
    return true;
  } catch {
    return false;
  }
}

// Decode the relative asset path and resolve it under the root, returning null if it would escape.
function resolveWithinRoot(assetRoot: string, assetPath: string): string | null {
  const decoded = decodePath(assetPath);
  if (decoded === null) {
    return null;
  }

  const resolvedPath = join(assetRoot, decoded);
  const relativePath = relative(assetRoot, resolvedPath);

  if (relativePath.startsWith('..') || isAbsolute(relativePath)) {
    return null;
  }

  return resolvedPath;
}

function decodePath(assetPath: string): string | null {
  try {
    return decodeURIComponent(assetPath);
  } catch {
    return null;
  }
}

async function serveFile(
  filePath: string,
  cacheControl: string,
  response: ServerResponse
): Promise<void> {
  const content = await readFile(filePath);

  response.writeHead(200, {
    'Cache-Control': cacheControl,
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

function isNodeFileError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}

function writeNotFound(response: ServerResponse, message: string): void {
  writeJson(response, 404, { error: message });
}
