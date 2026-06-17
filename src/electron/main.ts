import { app, BrowserWindow, dialog, ipcMain, Menu } from 'electron';
import { join } from 'node:path';

import { createGsiListener } from '../runtime/gsiListener.js';
import { createGsiLiveness } from '../runtime/gsiLiveness.js';
import { createOverlayGsiEventStream } from '../runtime/overlayGsiEventStream.js';
import { createOverlayHost } from '../runtime/overlayHost.js';
import {
  APP_DIRTY_CHANGED_CHANNEL,
  APP_QUIT_CONFIRMED_CHANNEL,
  APP_SAVE_AND_QUIT_CHANNEL
} from '../shared/ipcChannels.js';
import { logError } from '../shared/logger.js';
import { NETWORK_HOST, NETWORK_PORTS } from '../shared/networkConfig.js';

import { registerFontsIpc } from './ipc/fonts.js';
import { registerSettingsIpc } from './ipc/settings.js';

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

// Unsaved-changes guard for window close. The renderer mirrors its dirty flag here so the
// main process can intercept the close, and `allowClose` lets a confirmed quit pass through.
let rendererDirty = false;
let allowClose = false;

ipcMain.on(APP_DIRTY_CHANGED_CHANNEL, (_event, dirty: boolean) => {
  rendererDirty = dirty;
});

ipcMain.on(APP_QUIT_CONFIRMED_CHANNEL, () => {
  allowClose = true;
  BrowserWindow.getAllWindows().forEach((window) => window.close());
});

async function confirmCloseWithUnsavedChanges(window: BrowserWindow): Promise<void> {
  const { response } = await dialog.showMessageBox(window, {
    type: 'warning',
    buttons: ['Save', "Don't Save", 'Cancel'],
    defaultId: 0,
    cancelId: 2,
    title: 'Save changes?',
    // Lead with the decision; keep the consequence as a short secondary line so the
    // message + buttons are enough to act on without reading further.
    message: 'Save changes to the overlay layout before closing?',
    detail: "If you don't save, your changes will be lost."
  });

  if (response === 2) {
    return; // Cancel — keep the window open.
  }

  if (response === 1) {
    allowClose = true; // Don't Save — discard and quit.
    window.close();
    return;
  }

  // Save — let the renderer persist, then it calls back to confirm the quit.
  window.webContents.send(APP_SAVE_AND_QUIT_CHANNEL);
}

// Registered after the app is ready (electron-store needs the userData path).
let unregisterSettingsIpc: (() => void) | null = null;
let unregisterFontsIpc: (() => void) | null = null;

const unsubscribeGsiLiveness = gsiLiveness.onStatusChange((status) => {
  overlayGsiEventStream.setStatus(status);
});

const unsubscribeGsiEventStream = gsiListener.onPayload((payload) => {
  // Mark alive before broadcasting so a resuming feed sends `live` ahead of the payload.
  gsiLiveness.markAlive();
  overlayGsiEventStream.broadcast(payload);
});

async function createMainWindow(): Promise<void> {
  // Packaged builds serve static assets from the web bundle; dev reads them straight from static/.
  const iconPath = app.isPackaged
    ? join(app.getAppPath(), 'build/web/icon.ico')
    : join(app.getAppPath(), 'static/icon.ico');

  const window = new BrowserWindow({
    height: 900,
    icon: iconPath,
    minHeight: 720,
    minWidth: 1024,
    show: false,
    title: 'Observer Studio',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: join(app.getAppPath(), 'build/electron/electron/preload.cjs')
    },
    width: 1280
  });

  window.once('ready-to-show', () => {
    window.show();
  });

  // Surfaces a thrown/missing preload (e.g. the settings bridge) in the dev terminal.
  window.webContents.on('preload-error', (_event, preloadPath, error) => {
    logError(`Preload failed to load: ${preloadPath}`, error);
  });

  // Keep the window title fixed instead of following the page's document.title.
  window.on('page-title-updated', (event) => {
    event.preventDefault();
  });

  // Guard against losing unsaved overlay edits when the window is closed.
  window.on('close', (event) => {
    if (allowClose || !rendererDirty) {
      return;
    }

    event.preventDefault();
    void confirmCloseWithUnsavedChanges(window);
  });

  if (app.isPackaged) {
    await window.loadFile(join(app.getAppPath(), 'build/web/index.html'));
    return;
  }

  // The default menu (and its DevTools accelerator) is removed, so open it explicitly in dev.
  window.webContents.openDevTools({ mode: 'detach' });
  await window.loadURL('http://127.0.0.1:5173');
}

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);

  await Promise.all([overlayHost.start(), gsiListener.start(), overlayGsiEventStream.start()]);
  unregisterSettingsIpc = registerSettingsIpc(overlayGsiEventStream);
  unregisterFontsIpc = registerFontsIpc();
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
  unregisterSettingsIpc?.();
  unregisterFontsIpc?.();
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
