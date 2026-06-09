import { app, BrowserWindow, Menu } from 'electron';
import { join } from 'node:path';

import { createGsiListener } from '../runtime/gsiListener.js';
import { createGsiLiveness } from '../runtime/gsiLiveness.js';
import { createOverlayGsiEventStream } from '../runtime/overlayGsiEventStream.js';
import { createOverlayHost } from '../runtime/overlayHost.js';
import { NETWORK_HOST, NETWORK_PORTS } from '../shared/networkConfig.js';

app.setName('Observer Studio');

const gsiListener = createGsiListener({
  host: NETWORK_HOST,
  port: NETWORK_PORTS.gsiListener
});

const overlayHost = createOverlayHost({
  assetRoot: join(app.getAppPath(), 'build/overlay-assets/overlay'),
  host: NETWORK_HOST,
  port: NETWORK_PORTS.overlayHost
});

const overlayGsiEventStream = createOverlayGsiEventStream({
  host: NETWORK_HOST,
  port: NETWORK_PORTS.overlayEventStream
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

let isShuttingDown = false;

app.on('before-quit', (event) => {
  // Electron does not await this handler, so defer the quit until the ports are actually released.
  if (isShuttingDown) {
    return;
  }

  event.preventDefault();
  isShuttingDown = true;

  unsubscribeGsiEventStream();
  unsubscribeGsiLiveness();
  gsiLiveness.stop();

  void Promise.allSettled([
    gsiListener.stop(),
    overlayHost.stop(),
    overlayGsiEventStream.stop()
  ]).finally(() => {
    app.quit();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
