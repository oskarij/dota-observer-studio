import assert from 'node:assert/strict';
import test from 'node:test';

import { createGsiListener, type GsiPayload } from '../src/runtime/gsiListener.js';
import { createGsiLiveness } from '../src/runtime/gsiLiveness.js';

const HOST = '127.0.0.1';
const PORT = 31998;

test('the listener accepts only updates that carry its auth token', async () => {
  const listener = createGsiListener({ host: HOST, port: PORT, token: 'secret' });
  const accepted: GsiPayload[] = [];
  let rejected = 0;
  listener.onPayload((payload) => accepted.push(payload));
  listener.onRejected(() => rejected++);
  await listener.start();

  try {
    const post = async (body: unknown): Promise<number> =>
      (await fetch(`http://${HOST}:${PORT}/gsi`, { method: 'POST', body: JSON.stringify(body) }))
        .status;
    assert.equal(await post({ map: {} }), 401);
    assert.equal(await post({ auth: { token: 'wrong' }, map: {} }), 401);
    assert.equal(await post({ auth: { token: 'secret' }, map: {} }), 204);
    assert.equal(accepted.length, 1);
    assert.equal(rejected, 2);
  } finally {
    await listener.stop();
  }
});

test('rejected updates show as rejected but never replace a live feed', () => {
  const liveness = createGsiLiveness({ timeoutMs: 60_000 });
  liveness.markRejected();
  assert.equal(liveness.getStatus(), 'rejected');
  liveness.markAlive();
  liveness.markRejected();
  assert.equal(liveness.getStatus(), 'live');
  liveness.stop();
});
