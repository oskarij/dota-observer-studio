import type { IncomingMessage, ServerResponse } from 'node:http';

import { createManagedHttpServer } from './httpServer.js';
import { getRequestPath, normalizePath, writeJson, writeNoContent } from './httpUtils.js';
import { createObservers } from './observers.js';

export type GsiPayload = Record<string, unknown>;

export interface GsiListenerConfig {
  readonly host: string;
  readonly path?: string;
  readonly port: number;
}

export interface GsiListener {
  onPayload(listener: (payload: GsiPayload) => void): () => void;
  start(): Promise<void>;
  stop(): Promise<void>;
}

const DEFAULT_GSI_PATH = '/gsi';

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

  const httpServer = createManagedHttpServer({
    host: config.host,
    port: config.port,
    onRequest(request, response) {
      void handleRequest(request, response).catch((error: unknown) => {
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

    payloadObservers.emit(payload);
    writeNoContent(response);
  }

  return {
    onPayload: payloadObservers.add,
    start: httpServer.start,
    stop: httpServer.stop
  };
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  return await new Promise<unknown>((resolve, reject) => {
    const chunks: Buffer[] = [];
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
  });
}

function isGsiPayload(value: unknown): value is GsiPayload {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
