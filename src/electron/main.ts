import { app, BrowserWindow, dialog, ipcMain, Menu } from 'electron';
import { join } from 'node:path';

import { createKnownPlayersStore } from '../persistence/knownPlayersStore.js';
import { createPlayerRankStore } from '../persistence/playerRankStore.js';
import { createGsiListener } from '../runtime/gsiListener.js';
import { createGsiLiveness } from '../runtime/gsiLiveness.js';
import { createOverlayGsiEventStream } from '../runtime/overlayGsiEventStream.js';
import { createOverlayHost } from '../runtime/overlayHost.js';
import { createPlayerRankService } from '../runtime/playerRankService.js';
import {
  APP_DIRTY_CHANGED_CHANNEL,
  APP_QUIT_CONFIRMED_CHANNEL,
  APP_SAVE_AND_QUIT_CHANNEL
} from '../shared/ipcChannels.js';
import { logError } from '../shared/logger.js';
import { type ConfigurablePorts, NETWORK_HOST, NETWORK_PORTS } from '../shared/networkConfig.js';

import { registerFontsIpc } from './ipc/fonts.js';
import { registerGsiIpc } from './ipc/gsi.js';
import { registerKnownPlayersIpc } from './ipc/knownPlayers.js';
import { type ApplyPorts, registerNetworkIpc } from './ipc/network.js';
import { registerPlayerRanksIpc } from './ipc/playerRanks.js';
import { registerSettingsIpc } from './ipc/settings.js';
import { createNetworkSettingsStore } from './networkSettingsStore.js';

app.setName('Observer Studio');

// The servers are created inside whenReady because their ports come from the network settings store
// (electron-store needs the userData path, only available after the app is ready). They're kept at
// module scope so the before-quit handler can tear them down and the live port-rebind can swap them.
let gsiListener: ReturnType<typeof createGsiListener> | null = null;
let overlayHost: ReturnType<typeof createOverlayHost> | null = null;
let overlayGsiEventStream: ReturnType<typeof createOverlayGsiEventStream> | null = null;
let unwireGsiListener: (() => void) | null = null;
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

// Registered after the app is ready (electron-store and the rank DB need the userData path).
let unregisterSettingsIpc: (() => void) | null = null;
let unregisterFontsIpc: (() => void) | null = null;
let unregisterKnownPlayersIpc: (() => void) | null = null;
let unregisterNetworkIpc: (() => void) | null = null;
let unregisterGsiIpc: (() => void) | null = null;
let unregisterPlayerRanksIpc: (() => void) | null = null;
let unsubscribeGsiLiveness: (() => void) | null = null;
let closePlayerRankStore: (() => void) | null = null;
let closeKnownPlayersStore: (() => void) | null = null;

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

  // The overlay-host and GSI-listener ports are user-configurable and applied live (see applyPorts);
  // the event-stream port stays fixed because it's baked into the overlay bundle.
  const networkSettingsStore = createNetworkSettingsStore();
  let ports = networkSettingsStore.get();
  const overlayAssetRoot = join(app.getAppPath(), 'build/overlay-assets/overlay');

  overlayGsiEventStream = createOverlayGsiEventStream({
    host: NETWORK_HOST,
    port: NETWORK_PORTS.overlayEventStream
  });
  unsubscribeGsiLiveness = gsiLiveness.onStatusChange((status) => {
    overlayGsiEventStream?.setStatus(status);
  });
  await overlayGsiEventStream.start();

  // Curated player list (name + MMR keyed by account id). Lives in userData so it persists across
  // runs; seeded once from the bundled defaults, then edited in the studio and pushed to the overlay.
  const knownPlayersStore = createKnownPlayersStore(
    join(app.getPath('userData'), 'known-players.db')
  );
  closeKnownPlayersStore = () => knownPlayersStore.close();

  // Cache OpenDota ranks for selected players and push them to the live overlay (for the in-game
  // medal). The DB lives in userData, so it persists across runs and survives the free-tier limit.
  const playerRankStore = createPlayerRankStore(join(app.getPath('userData'), 'player-ranks.db'));
  const playerRankService = createPlayerRankService({
    sink: overlayGsiEventStream,
    store: playerRankStore
  });
  closePlayerRankStore = () => playerRankStore.close();

  // Both payload consumers (liveness + broadcast, and the rank service) re-subscribe whenever the
  // GSI listener is rebound to a new port, so this is a function rather than a one-shot wiring.
  const wireGsiListener = (listener: ReturnType<typeof createGsiListener>): (() => void) => {
    const unsubscribeBroadcast = listener.onPayload((payload) => {
      // Mark alive before broadcasting so a resuming feed sends `live` ahead of the payload.
      gsiLiveness.markAlive();
      overlayGsiEventStream?.broadcast(payload);
    });
    const unsubscribeRank = listener.onPayload((payload) => {
      playerRankService.handlePayload(payload);
    });

    return () => {
      unsubscribeBroadcast();
      unsubscribeRank();
    };
  };

  gsiListener = createGsiListener({ host: NETWORK_HOST, port: ports.gsiListener });
  overlayHost = createOverlayHost({
    assetRoot: overlayAssetRoot,
    host: NETWORK_HOST,
    port: ports.overlayHost
  });
  await Promise.all([gsiListener.start(), overlayHost.start()]);
  unwireGsiListener = wireGsiListener(gsiListener);

  // Apply new ports without a restart: start each changed server on its (different) port first, and
  // only swap + stop the old one once the new one is bound. On any bind failure nothing is committed
  // — the old servers keep running — so the caller can leave the persisted ports untouched.
  const applyPorts: ApplyPorts = async (next: ConfigurablePorts) => {
    let nextListener: ReturnType<typeof createGsiListener> | null = null;
    let nextHost: ReturnType<typeof createOverlayHost> | null = null;

    if (next.gsiListener !== ports.gsiListener) {
      const candidate = createGsiListener({ host: NETWORK_HOST, port: next.gsiListener });
      try {
        await candidate.start();
        nextListener = candidate;
      } catch (error) {
        await candidate.stop().catch(() => {});
        return { ok: false, reason: portInUseReason(next.gsiListener, error) };
      }
    }

    if (next.overlayHost !== ports.overlayHost) {
      const candidate = createOverlayHost({
        assetRoot: overlayAssetRoot,
        host: NETWORK_HOST,
        port: next.overlayHost
      });
      try {
        await candidate.start();
        nextHost = candidate;
      } catch (error) {
        await candidate.stop().catch(() => {});
        // Roll back the GSI rebind we may have already started, so the change is all-or-nothing.
        if (nextListener !== null) {
          await nextListener.stop().catch(() => {});
        }
        return { ok: false, reason: portInUseReason(next.overlayHost, error) };
      }
    }

    if (nextListener !== null) {
      unwireGsiListener?.();
      const previous = gsiListener;
      gsiListener = nextListener;
      unwireGsiListener = wireGsiListener(gsiListener);
      await previous?.stop().catch(() => {});
    }
    if (nextHost !== null) {
      const previous = overlayHost;
      overlayHost = nextHost;
      await previous?.stop().catch(() => {});
    }

    ports = next;
    return { ok: true };
  };

  unregisterSettingsIpc = registerSettingsIpc(overlayGsiEventStream);
  unregisterFontsIpc = registerFontsIpc();
  unregisterNetworkIpc = registerNetworkIpc(networkSettingsStore, applyPorts);
  unregisterGsiIpc = registerGsiIpc(networkSettingsStore);
  unregisterKnownPlayersIpc = registerKnownPlayersIpc(knownPlayersStore, overlayGsiEventStream);
  unregisterPlayerRanksIpc = registerPlayerRanksIpc(playerRankStore);

  await createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createMainWindow();
    }
  });
});

function portInUseReason(port: number, error: unknown): string {
  logError(`Failed to bind port ${port}`, error);
  return `Port ${port} could not be bound — it may be in use by another app.`;
}

let isShuttingDown = false;

app.on('before-quit', (event) => {
  // Electron does not await this handler, so defer the quit until the ports are actually released.
  if (isShuttingDown) {
    return;
  }

  event.preventDefault();
  isShuttingDown = true;

  unwireGsiListener?.();
  unsubscribeGsiLiveness?.();
  unregisterSettingsIpc?.();
  unregisterFontsIpc?.();
  unregisterKnownPlayersIpc?.();
  unregisterNetworkIpc?.();
  unregisterGsiIpc?.();
  unregisterPlayerRanksIpc?.();
  closePlayerRankStore?.();
  closeKnownPlayersStore?.();
  gsiLiveness.stop();

  void Promise.allSettled([
    gsiListener?.stop() ?? Promise.resolve(),
    overlayHost?.stop() ?? Promise.resolve(),
    overlayGsiEventStream?.stop() ?? Promise.resolve()
  ]).finally(() => {
    app.quit();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
