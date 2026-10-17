import assert from 'node:assert/strict';
import { mkdtemp, writeFile, unlink, rmdir } from 'node:fs/promises';
import { createServer, request } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createStaticFileHandler } from '../src/runtime/staticFiles.js';

test('video assets support bounded ranges, HEAD, full reads and safe fallback responses', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'observer-video-test-'));
  const fixture = Buffer.from('0123456789');
  await writeFile(join(root, 'portrait.webm'), fixture);
  await writeFile(join(root, 'index.html'), '<h1>Studio</h1>');
  await writeFile(join(root, 'empty.txt'), '');
  const handle = createStaticFileHandler({
    assetRoot: root,
    address: { host: '127.0.0.1', port: 0 },
    resolveAssetPath: (path) => path.slice(1),
    cacheControl: () => 'no-cache',
    fallbackOnMissing: (path) => (path === '/studio' ? 'index.html' : null),
    notFoundMessage: 'missing',
    readErrorMessage: 'failed'
  });
  const server = createServer((req, res) => {
    void handle(req, res);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    for (const file of ['portrait.webm', 'index.html', 'empty.txt']) await unlink(join(root, file));
    await rmdir(root);
  });
  const address = server.address();
  if (address === null || typeof address === 'string') throw Error('No listening port');
  const port = address.port;
  async function get(path: string, method = 'GET', headers: Record<string, string> = {}) {
    return await new Promise<{ status: number; headers: Record<string, unknown>; body: string }>(
      (resolve, reject) => {
        const req = request({ hostname: '127.0.0.1', port, path, method, headers }, (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk: Buffer) => chunks.push(chunk));
          res.on('end', () =>
            resolve({
              status: res.statusCode ?? 0,
              headers: res.headers,
              body: Buffer.concat(chunks).toString()
            })
          );
          res.on('error', reject);
        });
        req.on('error', reject);
        req.end();
      }
    );
  }
  const full = await get('/portrait.webm');
  assert.equal(full.status, 200);
  assert.equal(full.body, fixture.toString());
  assert.equal(full.headers['content-type'], 'video/webm');
  assert.equal(full.headers['content-length'], '10');
  for (const [range, expected, contentRange] of [
    ['bytes=2-5', '2345', 'bytes 2-5/10'],
    ['bytes=7-', '789', 'bytes 7-9/10'],
    ['bytes=-3', '789', 'bytes 7-9/10'],
    ['bytes=8-99', '89', 'bytes 8-9/10'],
    ['bytes=-99', '0123456789', 'bytes 0-9/10']
  ] as const) {
    const partial = await get('/portrait.webm', 'GET', { Range: range });
    assert.equal(partial.status, 206);
    assert.equal(partial.body, expected);
    assert.equal(partial.headers['content-range'], contentRange);
    assert.equal(partial.headers['content-length'], String(expected.length));
  }
  for (const range of ['bytes=10-', 'bytes=-0', 'bytes=5-3']) {
    const invalid = await get('/portrait.webm', 'GET', { Range: range });
    assert.equal(invalid.status, 416);
    assert.equal(invalid.headers['content-range'], 'bytes */10');
  }
  const head = await get('/portrait.webm', 'HEAD', { Range: 'bytes=2-3' });
  assert.equal(head.status, 200);
  assert.equal(head.headers['content-length'], '10');
  assert.equal(head.body, '');
  assert.equal(
    (await get('/portrait.webm', 'GET', { Range: 'bytes=2-3', 'If-Range': 'outdated' })).status,
    200
  );
  assert.equal((await get('/portrait.webm', 'GET', { Range: 'bytes=0-1,4-5' })).status, 200);
  assert.equal((await get('/empty.txt')).body, '');
  assert.equal((await get('/studio')).body, '<h1>Studio</h1>');
  assert.equal((await get('/missing')).status, 404);
  assert.equal((await get('/%2e%2e%2fprivate.txt')).status, 404);
});
