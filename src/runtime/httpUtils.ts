import type { IncomingMessage, OutgoingHttpHeaders, ServerResponse } from 'node:http';

export interface HttpServerAddress {
  readonly host: string;
  readonly port: number;
}

export function getRequestPath(request: IncomingMessage, address: HttpServerAddress): string {
  const requestUrl = new URL(request.url ?? '/', `http://${address.host}:${address.port}`);

  return normalizePath(requestUrl.pathname);
}

export function normalizePath(path: string): string {
  const pathWithSlash = path.startsWith('/') ? path : `/${path}`;

  if (pathWithSlash.length > 1 && pathWithSlash.endsWith('/')) {
    return pathWithSlash.slice(0, -1);
  }

  return pathWithSlash;
}

export function writeJson(
  response: ServerResponse,
  statusCode: number,
  body: unknown,
  headers: OutgoingHttpHeaders = {}
): void {
  response.writeHead(statusCode, {
    ...headers,
    'Content-Type': 'application/json; charset=utf-8'
  });
  response.end(JSON.stringify(body));
}

export function writeNoContent(
  response: ServerResponse,
  headers: OutgoingHttpHeaders = {}
): void {
  response.writeHead(204, headers);
  response.end();
}
