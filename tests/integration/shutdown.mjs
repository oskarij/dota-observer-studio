import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';

const profile = mkdtempSync(join(tmpdir(), 'observer-shutdown-test-'));
app.setPath('userData', profile);
Object.defineProperty(app, 'isPackaged', { value: true });
app.getAppPath = () => resolve('.');
BrowserWindow.prototype.show = function () {};
globalThis.fetch = async () => {
  throw new Error('Offline shutdown test');
};

async function freePort() {
  const server = createServer();
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  const port = server.address().port;
  await new Promise((done) => server.close(done));
  return port;
}
const ports = { overlayHost: await freePort(), gsiListener: await freePort() };
writeFileSync(
  join(profile, 'config.json'),
  JSON.stringify({ networkPorts: ports, allowLanAccess: false })
);
const timeout = setTimeout(() => {
  console.error('Shutdown integration test timed out');
  process.exit(1);
}, 20_000);
let tested = false;
app.on('quit', (_event, code) => {
  clearTimeout(timeout);
  assert.equal(tested, true);
  assert.equal(code, 0);
  console.log('PASS normal shutdown finishes after cancelled quit attempts');
});

await import(pathToFileURL(resolve('build/electron/electron/main.js')).href);
void app.whenReady().then(async () => {
  try {
    let window;
    for (let attempt = 0; attempt < 100; attempt++) {
      window = BrowserWindow.getAllWindows()[0];
      if (
        window &&
        !window.webContents.isLoading() &&
        window.webContents.getURL().startsWith('http:')
      )
        break;
      await delay(25);
    }
    assert.ok(window);
    let prompts = 0;
    let answer;
    dialog.showMessageBox = () => {
      prompts++;
      return new Promise((done) => {
        answer = done;
      });
    };
    ipcMain.emit('app:dirty-changed', {}, true);
    app.quit();
    app.quit();
    assert.equal(prompts, 1);
    answer({ response: 2 });
    await delay(25);
    const snapshot = await window.webContents.executeJavaScript(
      'window.dotaSpectatorTools.series.get()'
    );
    assert.ok(snapshot.sides);
    const http = await import('node:http');
    const status = await new Promise((done, reject) => {
      http
        .get(`http://127.0.0.1:${ports.overlayHost}/overlay/draft/`, (response) => {
          response.resume();
          done(response.statusCode);
        })
        .on('error', reject);
    });
    assert.equal(status, 200);
    console.log(
      'PASS cancelling repeated quit attempts keeps controls and overlay serving; only one prompt opens'
    );
    tested = true;
    ipcMain.emit('app:dirty-changed', {}, false);
    app.quit();
  } catch (error) {
    console.error(error);
    clearTimeout(timeout);
    app.exit(1);
  }
});
