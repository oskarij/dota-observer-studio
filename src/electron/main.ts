import { app, BrowserWindow } from 'electron';
import { join } from 'node:path';

import { createOverlayHost } from '../runtime/overlayHost.js';

const overlayHost = createOverlayHost({
  host: '127.0.0.1',
  port: 3333
});

async function createMainWindow(): Promise<void> {
  const window = new BrowserWindow({
    height: 900,
    minHeight: 720,
    minWidth: 1024,
    show: false,
    title: 'Dota Spectator Tools',
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
  await overlayHost.start();
  await createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createMainWindow();
    }
  });
});

app.on('before-quit', () => {
  void overlayHost.stop();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

