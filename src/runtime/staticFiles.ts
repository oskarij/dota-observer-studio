import { open } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { extname, isAbsolute, join, relative } from 'node:path';
import { pipeline } from 'node:stream/promises';

import { OVERLAY_EVENTS_PATH } from '../shared/networkConfig.js';
import { getRequestPath, type HttpServerAddress, writeJson } from './httpUtils.js';

export interface StaticFileHandlerConfig {
  readonly assetRoot: string;
  readonly address: HttpServerAddress;
  // Map a normalized request path to a relative asset path under assetRoot, or null for a 404.
  resolveAssetPath(requestPath: string): string | null;
  cacheControl(assetPath: string): string;
  // Optional fallback asset when the resolved file is missing (e.g. an SPA index). Null = 404.
  fallbackOnMissing?(requestPath: string): string | null;
  // Handles GET OVERLAY_EVENTS_PATH (the SSE stream) when set.
  connectEvents?(request: IncomingMessage, response: ServerResponse): void;
  readonly notFoundMessage: string;
  readonly readErrorMessage: string;
}

export type StaticFileHandler = (
  request: IncomingMessage,
  response: ServerResponse
) => Promise<void>;

// Serves files from one asset root, behind the path-traversal guard. Each host supplies the path
// mapping and cache policy.
export function createStaticFileHandler(config: StaticFileHandlerConfig): StaticFileHandler {
  return async function handle(request, response) {
    const method = request.method?.toUpperCase() ?? 'GET';
    if (method !== 'GET' && method !== 'HEAD') {
      writeNotFound(response, config.notFoundMessage);
      return;
    }

    const requestPath = getRequestPath(request, config.address);
    if (
      method === 'GET' &&
      config.connectEvents !== undefined &&
      requestPath === OVERLAY_EVENTS_PATH
    ) {
      config.connectEvents(request, response);
      return;
    }

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
      await serveFile(filePath, config.cacheControl(assetPath), request, response);
    } catch (error) {
      if (response.headersSent || response.destroyed) return;
      if (isNodeFileError(error) && error.code === 'ENOENT') {
        const fallback = config.fallbackOnMissing?.(requestPath) ?? null;
        if (
          fallback !== null &&
          (await serveFallback(config.assetRoot, fallback, config, request, response))
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
  request: IncomingMessage,
  response: ServerResponse
): Promise<boolean> {
  const fallbackPath = resolveWithinRoot(assetRoot, fallback);
  if (fallbackPath === null) {
    return false;
  }

  try {
    await serveFile(fallbackPath, config.cacheControl(fallback), request, response);
    return true;
  } catch {
    return response.headersSent || response.destroyed;
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
  request: IncomingMessage,
  response: ServerResponse
): Promise<void> {
  const file = await open(filePath, 'r');
  try {
    const info = await file.stat();
    if (!info.isFile()) throw Object.assign(new Error('Not a file'), { code: 'ENOENT' });
    const range =
      request.method === 'HEAD' || request.headers['if-range'] !== undefined
        ? null
        : readByteRange(request.headers.range, info.size);
    const headers = {
      'Accept-Ranges': 'bytes',
      'Cache-Control': cacheControl,
      'Content-Type': getContentType(filePath)
    };
    if (range === 'unsatisfiable') {
      response.writeHead(416, {
        ...headers,
        'Content-Range': `bytes */${info.size}`,
        'Content-Length': 0
      });
      response.end();
      return;
    }
    const start = range?.start ?? 0;
    const end = range?.end ?? info.size - 1;
    response.writeHead(range === null ? 200 : 206, {
      ...headers,
      'Content-Length': Math.max(0, end - start + 1),
      ...(range !== null ? { 'Content-Range': `bytes ${start}-${end}/${info.size}` } : {})
    });
    if (request.method === 'HEAD' || info.size === 0) {
      response.end();
      return;
    }
    // Stream with backpressure and honor range requests: ten looping portraits would otherwise
    // buffer ten multi-megabyte files at once.
    await pipeline(file.createReadStream({ start, end, autoClose: false }), response);
  } finally {
    await file.close();
  }
}

function readByteRange(
  header: string | undefined,
  size: number
): { start: number; end: number } | 'unsatisfiable' | null {
  if (header === undefined) return null;
  // Multiple ranges and unknown units are ignored (serve the complete representation).
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (match === null || (match[1] === '' && match[2] === '')) return null;
  const suffix = match[1] === '';
  const first = Number(suffix ? match[2] : match[1]);
  const last = match[2] === '' || suffix ? size - 1 : Number(match[2]);
  if (!Number.isSafeInteger(first) || !Number.isSafeInteger(last) || size === 0)
    return 'unsatisfiable';
  const start = suffix ? Math.max(0, size - first) : first;
  const end = Math.min(last, size - 1);
  return start > end ? 'unsatisfiable' : { start, end };
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
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.svg':
      return 'image/svg+xml';
    case '.webm':
      return 'video/webm';
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
