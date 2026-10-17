import assert from 'node:assert/strict';
import test from 'node:test';
import { connect } from 'node:net';

import { createManagedHttpServer } from '../src/runtime/httpServer.js';
import { probePort } from './portProbe.js';

const HOST = '127.0.0.1';
const PORT = 31987;

test('start binds the port and stop releases it', async () => {
  const managed = createManagedHttpServer({
    host: HOST,
    port: PORT,
    onRequest(_request, response) {
      response.end();
    }
  });

  await managed.start();
  await assert.rejects(probePort(HOST, PORT));

  await managed.stop();
  await assert.doesNotReject(probePort(HOST, PORT));
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

  await assert.doesNotReject(probePort(HOST, PORT));
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

test('concurrent starts and a stop during startup leave no listener behind', async () => {
  const managed = createManagedHttpServer({
    host: HOST,
    port: PORT,
    onRequest(_request, response) {
      response.end();
    }
  });
  const first = managed.start();
  const second = managed.start();
  const stopping = managed.stop();
  const results = await Promise.allSettled([first, second, stopping]);
  try {
    assert.ok(results.every((result) => result.status === 'fulfilled'));
    assert.equal(managed.address(), null);
  } finally {
    await managed.stop();
  }
});

test('shutdown closes a TCP connection that has not sent HTTP headers', async () => {
  const managed = createManagedHttpServer({
    host: HOST,
    port: 0,
    onRequest(_request, response) {
      response.end();
    }
  });
  await managed.start();
  const address = managed.address();
  assert.ok(address);
  const socket = connect(address.port, HOST);
  await new Promise<void>((resolve) => socket.once('connect', resolve));
  const stopping = managed.stop();
  let timeout: ReturnType<typeof setTimeout> | undefined = undefined;
  try {
    await Promise.race([
      stopping,
      new Promise<void>((_resolve, reject) => {
        timeout = setTimeout(
          () => reject(new Error('Shutdown stalled on an idle connection')),
          300
        );
      })
    ]);
  } finally {
    clearTimeout(timeout);
    socket.destroy();
    await stopping;
  }
});
