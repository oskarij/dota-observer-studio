import assert from 'node:assert/strict';
import { createServer, request } from 'node:http';
import test from 'node:test';

import { createGsiListener, type GsiPayload } from '../src/runtime/gsiListener.js';

// Exercises the live port-rebind contract that main.ts's applyPorts orchestrates: the GSI listener
// is swapped to a new port without a restart, the old port is released, payload subscribers are
// re-wired to the new server, and a rebind onto an occupied port fails without disturbing the
// running server. These are the guarantees the Settings "Network ports" Save action depends on.

const HOST = '127.0.0.1';
const PORT_A = 31994;
const PORT_B = 31995;

// Resolves if the port is free (bindable), rejects if it is already taken.
async function probePort(port: number): Promise<void> {
  const probe = createServer();

  try {
    await new Promise<void>((resolve, reject) => {
      probe.once('error', reject);
      probe.listen(port, HOST, resolve);
    });
  } finally {
    await new Promise<void>((resolve) => {
      probe.close(() => {
        resolve();
      });
    });
  }
}

// POSTs a JSON payload to the GSI endpoint and resolves with the response status code.
async function postPayload(port: number, payload: GsiPayload): Promise<number> {
  const body = JSON.stringify(payload);

  return await new Promise<number>((resolve, reject) => {
    const req = request(
      { host: HOST, port, path: '/gsi', method: 'POST' },
      (response) => {
        response.resume();
        response.once('end', () => resolve(response.statusCode ?? 0));
      }
    );
    req.once('error', reject);
    req.end(body);
  });
}

test('rebinding to a new port serves there, frees the old port, and re-wires subscribers', async () => {
  // Mirror applyPorts: a wireGsiListener that subscribes the current listener, swap to a candidate
  // started on the new port, re-wire, then stop the old one.
  const received: GsiPayload[] = [];
  const wire = (listener: ReturnType<typeof createGsiListener>): (() => void) =>
    listener.onPayload((payload) => received.push(payload));

  let listener = createGsiListener({ host: HOST, port: PORT_A });
  await listener.start();
  let unwire = wire(listener);

  // Old port is bound and delivering payloads to the wired subscriber.
  assert.equal(await postPayload(PORT_A, { provider: { a: 1 } }), 204);
  assert.equal(received.length, 1);

  // Start the new server on PORT_B *before* tearing down the old one (start-new-before-stop-old).
  const candidate = createGsiListener({ host: HOST, port: PORT_B });
  await candidate.start();

  unwire();
  const previous = listener;
  listener = candidate;
  unwire = wire(listener);
  await previous.stop();

  // New port serves and the re-wired subscriber receives; old port is released.
  assert.equal(await postPayload(PORT_B, { provider: { b: 2 } }), 204);
  assert.equal(received.length, 2);
  await assert.doesNotReject(probePort(PORT_A), 'old port should be free after the swap');

  unwire();
  await listener.stop();
});

test('rebinding onto an occupied port fails and leaves the running server intact', async () => {
  const received: GsiPayload[] = [];

  const listener = createGsiListener({ host: HOST, port: PORT_A });
  await listener.start();
  const unwire = listener.onPayload((payload) => received.push(payload));

  // Squat on the target port so the candidate cannot bind it.
  const squatter = createGsiListener({ host: HOST, port: PORT_B });
  await squatter.start();

  // applyPorts starts a candidate and returns ok:false on bind failure without committing the swap.
  const candidate = createGsiListener({ host: HOST, port: PORT_B });
  await assert.rejects(candidate.start(), 'binding an occupied port must reject');
  await candidate.stop().catch(() => {});

  // The original listener is untouched and still serving on its port.
  assert.equal(await postPayload(PORT_A, { provider: { still: 'up' } }), 204);
  assert.equal(received.length, 1);

  unwire();
  await Promise.all([listener.stop(), squatter.stop()]);
});
