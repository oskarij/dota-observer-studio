import { app, BrowserWindow, Menu } from 'electron';
import { join } from 'node:path';

import { createGsiListener } from '../runtime/gsiListener.js';
import { createGsiLiveness } from '../runtime/gsiLiveness.js';
import { createOverlayGsiEventStream } from '../runtime/overlayGsiEventStream.js';
import { createOverlayHost } from '../runtime/overlayHost.js';

app.setName('Observer Studio');

const gsiListener = createGsiListener({
  host: '127.0.0.1',
  port: 3334
});

const overlayHost = createOverlayHost({
  assetRoot: join(app.getAppPath(), 'build/overlay-assets/overlay'),
  host: '127.0.0.1',
  port: 3333
});

const overlayGsiEventStream = createOverlayGsiEventStream({
  host: '127.0.0.1',
  port: 3335
});

const gsiLiveness = createGsiLiveness();

const unsubscribeGsiLiveness = gsiLiveness.onStatusChange((status) => {
  overlayGsiEventStream.setStatus(status);
});

const unsubscribeGsiEventStream = gsiListener.onPayload((payload) => {
  // Mark alive before broadcasting so a resuming feed sends `live` ahead of the payload.
  gsiLiveness.markAlive();
  overlayGsiEventStream.broadcast(payload);
});

async function createMainWindow(): Promise<void> {
  const window = new BrowserWindow({
    height: 900,
    minHeight: 720,
    minWidth: 1024,
    show: false,
    title: 'Observer Studio',
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

  // Keep the window title fixed instead of following the page's document.title.
  window.on('page-title-updated', (event) => {
    event.preventDefault();
  });

  if (app.isPackaged) {
    await window.loadFile(join(app.getAppPath(), 'build/web/index.html'));
    return;
  }

  await window.loadURL('http://127.0.0.1:5173');
}

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);

  await Promise.all([overlayHost.start(), gsiListener.start(), overlayGsiEventStream.start()]);
  await createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createMainWindow();
    }
  });
});

app.on('before-quit', () => {
  unsubscribeGsiEventStream();
  unsubscribeGsiLiveness();
  gsiLiveness.stop();
  void gsiListener.stop();
  void overlayHost.stop();
  void overlayGsiEventStream.stop();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
