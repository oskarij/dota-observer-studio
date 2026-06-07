import { app, BrowserWindow, Menu } from 'electron';
import { join } from 'node:path';

import { createGsiListener } from '../runtime/gsiListener.js';
import { createOverlayHost } from '../runtime/overlayHost.js';
import { createOverlayRealtime } from '../runtime/overlayRealtime.js';

app.setName('Dota Spectator Overlay Studio');

const gsiListener = createGsiListener({
  host: '127.0.0.1',
  port: 3334
});

const overlayHost = createOverlayHost({
  assetRoot: join(app.getAppPath(), 'build/overlay-assets/overlay'),
  host: '127.0.0.1',
  port: 3333
});

const overlayRealtime = createOverlayRealtime({
  host: '127.0.0.1',
  port: 3335
});

const unsubscribeGsiRealtime = gsiListener.onPayload((payload) => {
  overlayRealtime.broadcast(payload);
});

async function createMainWindow(): Promise<void> {
  const window = new BrowserWindow({
    height: 900,
    minHeight: 720,
    minWidth: 1024,
    show: false,
    title: 'Overlay Studio',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: join(app.getAppPath(), 'build/electron/electron/preload.js')
    },
    width: 1280
  });

  window.once('ready-to-show', () => {
    window.show();
  });

  if (app.isPackaged) {
    await window.loadFile(join(app.getAppPath(), 'build/web/index.html'));
    return;
  }

  await window.loadURL('http://127.0.0.1:5173');
}

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);

  await Promise.all([overlayHost.start(), gsiListener.start(), overlayRealtime.start()]);
  await createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createMainWindow();
    }
  });
});

app.on('before-quit', () => {
  unsubscribeGsiRealtime();
  void gsiListener.stop();
  void overlayHost.stop();
  void overlayRealtime.stop();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
