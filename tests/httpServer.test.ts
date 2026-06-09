import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';

import { createManagedHttpServer } from '../src/runtime/httpServer.js';

const HOST = '127.0.0.1';
const PORT = 31987;

// Resolves if the port can be bound (it is free), rejects otherwise (it is taken).
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

test('start binds the port and stop releases it', async () => {
  const managed = createManagedHttpServer({
    host: HOST,
    port: PORT,
    onRequest(_request, response) {
      response.end();
    }
  });

  await managed.start();
  await assert.rejects(probePort(PORT));

  await managed.stop();
  await assert.doesNotReject(probePort(PORT));
});

test('double start and double stop are idempotent', async () => {
  const managed = createManagedHttpServer({
    host: HOST,
    port: PORT,
    onRequest(_request, response) {
      response.end();
    }
  });

  await managed.start();
  await managed.start();
  await managed.stop();
  await managed.stop();

  await assert.doesNotReject(probePort(PORT));
});

test('onBeforeClose runs during stop, even before start', async () => {
  let calls = 0;
  const managed = createManagedHttpServer({
    host: HOST,
    port: PORT,
    onRequest(_request, response) {
      response.end();
    },
    onBeforeClose() {
      calls += 1;
    }
  });

  await managed.stop();
  assert.equal(calls, 1);

  await managed.start();
  await managed.stop();
  assert.equal(calls, 2);
});
