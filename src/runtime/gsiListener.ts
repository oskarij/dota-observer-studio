import type { IncomingMessage, ServerResponse } from 'node:http';

import { isRecord } from '../shared/validation.js';
import { createManagedHttpServer } from './httpServer.js';
import { getRequestPath, normalizePath, writeJson, writeNoContent } from './httpUtils.js';
import { createObservers } from './observers.js';

export type GsiPayload = Record<string, unknown>;

export interface GsiListenerConfig {
  readonly host: string;
  readonly path?: string;
  readonly port: number;
  // Dota sends it from the GSI config's auth block; updates without it are rejected.
  readonly token: string;
}

export interface GsiListener {
  onPayload(listener: (payload: GsiPayload) => void): () => void;
  onRejected(listener: (payload: GsiPayload) => void): () => void;
  start(): Promise<void>;
  stop(): Promise<void>;
}

const DEFAULT_GSI_PATH = '/gsi';
// GSI payloads are small (gsiConfig trims the data blocks). The cap applies before the token check.
const MAX_GSI_BODY_BYTES = 256 * 1024;

class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    message: string
  ) {
    super(message);
  }
}

export function createGsiListener(config: GsiListenerConfig): GsiListener {
  const endpointPath = normalizePath(config.path ?? DEFAULT_GSI_PATH);
  const payloadObservers = createObservers<GsiPayload>('GSI payload');
  const rejectedObservers = createObservers<GsiPayload>('GSI rejected payload');

  const httpServer = createManagedHttpServer({
    host: config.host,
    port: config.port,
    onRequest(request, response) {
      void handleRequest(request, response).catch((error: unknown) => {
        // The request may have been aborted mid-body; only respond if the socket is still writable.
        if (!response.writable) {
          return;
        }

        const statusCode = error instanceof HttpError ? error.statusCode : 500;
        const message = error instanceof Error ? error.message : 'Unexpected GSI listener error';

        writeJson(response, statusCode, {
          error: message
        });
      });
    }
  });

  async function handleRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const method = request.method?.toUpperCase() ?? 'GET';
    const path = getRequestPath(request, config);

    if (method !== 'POST' || path !== endpointPath) {
      writeJson(response, 404, {
        error: 'GSI listener route not found'
      });
      return;
    }

    const payload = await readJsonBody(request);

    if (!isGsiPayload(payload)) {
      throw new HttpError(400, 'GSI payload must be a JSON object');
    }

    if (!isRecord(payload.auth) || payload.auth.token !== config.token) {
      writeJson(response, 401, { error: 'GSI auth token missing or wrong' });
      rejectedObservers.emit(payload);
      return;
    }

    writeNoContent(response);
    payloadObservers.emit(payload);
  }

  return {
    onPayload: payloadObservers.add,
    onRejected: rejectedObservers.add,
    start: httpServer.start,
    stop: httpServer.stop
  };
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  return await new Promise<unknown>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    let settled = false;

    function resolveOnce(value: unknown): void {
      if (settled) {
        return;
      }

      settled = true;
      resolve(value);
    }

    function rejectOnce(error: Error): void {
      if (settled) {
        return;
      }

      settled = true;
      reject(error);
    }

    request.on('data', (chunk: Buffer | string) => {
      const buffer = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
      total += buffer.length;

      if (total > MAX_GSI_BODY_BYTES) {
        rejectOnce(new HttpError(413, 'GSI payload too large'));
        request.destroy();
        return;
      }

      chunks.push(buffer);
    });

    request.once('end', () => {
      const body = Buffer.concat(chunks).toString('utf8');

      if (body.trim().length === 0) {
        rejectOnce(new HttpError(400, 'GSI payload body is empty'));
        return;
      }

      try {
        resolveOnce(JSON.parse(body));
      } catch {
        rejectOnce(new HttpError(400, 'GSI payload body must be valid JSON'));
      }
    });

    request.once('error', (error) => {
      rejectOnce(error);
    });

    // A client that drops the connection mid-body never emits 'end'; settle so the buffered chunks
    // are released instead of being retained until the socket is eventually reaped.
    request.once('close', () => {
      rejectOnce(new HttpError(400, 'GSI request closed before the body finished'));
    });
  });
}

function isGsiPayload(value: unknown): value is GsiPayload {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
