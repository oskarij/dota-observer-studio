import { app, BrowserWindow, dialog, ipcMain, Menu, session, shell } from 'electron';
import { join } from 'node:path';

import { createKnownPlayersStore } from '../persistence/knownPlayersStore.js';
import { createPlayerRankStore } from '../persistence/playerRankStore.js';
import { createFearlessCapture } from '../runtime/fearlessCapture.js';
import { createGsiListener } from '../runtime/gsiListener.js';
import { createGsiLiveness } from '../runtime/gsiLiveness.js';
import { createOverlayGsiEventStream } from '../runtime/overlayGsiEventStream.js';
import { createOverlayHost } from '../runtime/overlayHost.js';
import { createPlayerRankService } from '../runtime/playerRankService.js';
import { createWebHost } from '../runtime/webHost.js';
import {
  APP_DIRTY_CHANGED_CHANNEL,
  APP_QUIT_CONFIRMED_CHANNEL,
  APP_SAVE_AND_QUIT_CHANNEL,
  WATCHED_GAMES_CHANGED_CHANNEL
} from '../shared/ipcChannels.js';
import { logError } from '../shared/logger.js';
import { type ConfigurablePorts, LAN_BIND_HOST, NETWORK_HOST } from '../shared/networkConfig.js';

import { createFearlessStore } from './fearlessStore.js';
import { registerFearlessDraftIpc } from './ipc/fearlessDraft.js';
import { registerFontsIpc } from './ipc/fonts.js';
import { registerGsiIpc } from './ipc/gsi.js';
import { registerKnownPlayersIpc } from './ipc/knownPlayers.js';
import { type ApplyPorts, registerNetworkIpc } from './ipc/network.js';
import { registerPlayerRanksIpc } from './ipc/playerRanks.js';
import { registerSettingsIpc } from './ipc/settings.js';
import { createNetworkSettingsStore } from './networkSettingsStore.js';

app.setName('Observer Studio');

// CSP for the studio window (packaged builds only; dev is served by Vite, which needs inline scripts
// and its HMR socket). 'unsafe-inline' is kept because the SvelteKit bootstrap and component styles
// are inline; the value here locks the window to its own origin so injected markup can't load remote
// scripts or exfiltrate to a remote host. The /events feed is same-origin, so connect-src is 'self'.
const STUDIO_CSP =
  "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; " +
  "img-src 'self' data:; font-src 'self' data:; connect-src 'self'; " +
  "object-src 'none'; base-uri 'none'; frame-ancestors 'none'";

// The servers are created inside whenReady because their ports come from the network settings store
// (electron-store needs the userData path, only available after the app is ready). They're kept at
// module scope so the before-quit handler can tear them down and the live port-rebind can swap them.
let gsiListener: ReturnType<typeof createGsiListener> | null = null;
let overlayHost: ReturnType<typeof createOverlayHost> | null = null;
let webHost: ReturnType<typeof createWebHost> | null = null;
let overlayGsiEventStream: ReturnType<typeof createOverlayGsiEventStream> | null = null;
let unwireGsiListener: (() => void) | null = null;
const gsiLiveness = createGsiLiveness();

// Renderer mirrors its dirty flag here so main can intercept the close; allowClose lets a confirmed quit pass through.
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
    return; // Cancel: keep the window open.
  }

  if (response === 1) {
    allowClose = true; // Don't Save: discard and quit.
    window.close();
    return;
  }

  // Save: let the renderer persist, then it calls back to confirm the quit.
  window.webContents.send(APP_SAVE_AND_QUIT_CHANNEL);
}

// Registered after the app is ready (electron-store and the rank DB need the userData path).
let unregisterSettingsIpc: (() => void) | null = null;
let unregisterFontsIpc: (() => void) | null = null;
let unregisterKnownPlayersIpc: (() => void) | null = null;
let unregisterFearlessDraftIpc: (() => void) | null = null;
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
    height: 860,
    icon: iconPath,
    minHeight: 720,
    minWidth: 1024,
    show: false,
    title: 'Observer Studio',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: join(app.getAppPath(), 'build/electron/electron/preload.cjs')
    },
    width: 1635
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

  window.on('close', (event) => {
    if (allowClose || !rendererDirty) {
      return;
    }

    event.preventDefault();
    void confirmCloseWithUnsavedChanges(window);
  });

  // Keep all navigation inside the app's own loopback origin: deny child windows (route external
  // links to the OS browser instead) and block any attempt to navigate the window off-origin.
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      void shell.openExternal(url);
    }
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', (event, url) => {
    const allowedOrigin = app.isPackaged
      ? `http://${NETWORK_HOST}:${webHost?.port() ?? ''}`
      : 'http://127.0.0.1:5173';
    if (url !== allowedOrigin && !url.startsWith(`${allowedOrigin}/`)) {
      event.preventDefault();
    }
  });

  if (app.isPackaged) {
    // Served over loopback HTTP (not loadFile) so the build's absolute asset URLs and the client
    // router work. file:// breaks both. The host is started (on an OS-assigned port) in whenReady
    // before the window opens, so its port is always available here.
    const webHostPort = webHost?.port();
    if (webHostPort === null || webHostPort === undefined) {
      throw new Error('Web host is not running; cannot load the studio UI.');
    }

    await window.loadURL(`http://${NETWORK_HOST}:${webHostPort}/`);
    return;
  }

  // The default menu (and its DevTools accelerator) is removed, so open it explicitly in dev.
  window.webContents.openDevTools({ mode: 'detach' });
  await window.loadURL('http://127.0.0.1:5173');
}

app
  .whenReady()
  .then(async () => {
    Menu.setApplicationMenu(null);

    if (app.isPackaged) {
      session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        callback({
          responseHeaders: {
            ...details.responseHeaders,
            'Content-Security-Policy': [STUDIO_CSP]
          }
        });
      });
    }

    // The overlay-host and GSI-listener ports are user-configurable and applied live (see applyPorts).
    const networkSettingsStore = createNetworkSettingsStore();
    const networkSettings = networkSettingsStore.get();
    let ports = networkSettings.ports;
    const overlayAssetRoot = join(app.getAppPath(), 'build/overlay-assets/overlay');

    // When LAN access is on, the overlay host and GSI listener bind every interface so a separate
    // OBS or observer PC can reach them. The web host (studio UI) stays on loopback.
    const lanActive = networkSettings.allowLanAccess;
    const lanBindHost = lanActive ? LAN_BIND_HOST : NETWORK_HOST;

    // The SSE hub owns no socket; the overlay host (and the packaged web host) route /events to it,
    // so it survives a host's port rebind.
    const eventStream = createOverlayGsiEventStream();
    overlayGsiEventStream = eventStream;
    unsubscribeGsiLiveness = gsiLiveness.onStatusChange((status) => {
      eventStream.setStatus(status);
    });
    eventStream.start();

    // Curated player list (name + MMR by account id); userData so it persists, seeded once from bundled defaults.
    const knownPlayersStore = createKnownPlayersStore(
      join(app.getPath('userData'), 'known-players.db')
    );
    closeKnownPlayersStore = () => knownPlayersStore.close();

    // Cache OpenDota ranks for selected players and push them to the live overlay (for the in-game
    // medal). The DB lives in userData, so it persists across runs and survives the free-tier limit.
    const playerRankStore = createPlayerRankStore(join(app.getPath('userData'), 'player-ranks.db'));
    const playerRankService = createPlayerRankService({
      sink: eventStream,
      store: playerRankStore
    });
    closePlayerRankStore = () => playerRankStore.close();

    // Auto-captured watched games + the current fearless series (electron-store, restart-safe). The
    // GSI capture records each spectated game's locked lineup; the operator later builds a series.
    const fearlessStore = createFearlessStore();
    const notifyWatchedGamesChanged = (): void => {
      for (const window of BrowserWindow.getAllWindows()) {
        window.webContents.send(WATCHED_GAMES_CHANGED_CHANNEL);
      }
    };
    const fearlessCapture = createFearlessCapture({
      upsert: (game) => {
        fearlessStore.upsertWatchedGame(game);
        notifyWatchedGamesChanged();
      }
    });

    // Both payload consumers (liveness + broadcast, the rank service, and the fearless capture)
    // re-subscribe whenever the GSI listener is rebound to a new port, so this is a function rather
    // than a one-shot wiring.
    const wireGsiListener = (listener: ReturnType<typeof createGsiListener>): (() => void) => {
      const unsubscribeBroadcast = listener.onPayload((payload) => {
        // Mark alive before broadcasting so a resuming feed sends `live` ahead of the payload.
        gsiLiveness.markAlive();
        eventStream.broadcast(payload);
      });
      const unsubscribeRank = listener.onPayload((payload) => {
        playerRankService.handlePayload(payload);
      });
      const unsubscribeFearless = listener.onPayload((payload) => {
        fearlessCapture.handlePayload(payload);
      });

      return () => {
        unsubscribeBroadcast();
        unsubscribeRank();
        unsubscribeFearless();
      };
    };

    // Tracks which integration server (if any) couldn't bind its port at startup; surfaced in the UI.
    const portConflicts = { overlayHost: false, gsiListener: false };

    gsiListener = createGsiListener({ host: lanBindHost, port: ports.gsiListener });
    overlayHost = createOverlayHost({
      assetRoot: overlayAssetRoot,
      host: lanBindHost,
      port: ports.overlayHost,
      eventStream
    });
    // A busy port must not stop the app from opening (the window is served by the OS-assigned web
    // host); a failed bind is surfaced in the UI so the user can change the port in Settings.
    portConflicts.gsiListener = !(await startServer(gsiListener, ports.gsiListener));
    portConflicts.overlayHost = !(await startServer(overlayHost, ports.overlayHost));
    unwireGsiListener = wireGsiListener(gsiListener);

    // Apply new ports without a restart: start each changed server on its (different) port first, and
    // only swap + stop the old one once the new one is bound. On any bind failure nothing is committed
    // (the old servers keep running), so the caller can leave the persisted ports untouched.
    const applyPorts: ApplyPorts = async (next: ConfigurablePorts) => {
      let nextListener: ReturnType<typeof createGsiListener> | null = null;
      let nextHost: ReturnType<typeof createOverlayHost> | null = null;

      if (next.gsiListener !== ports.gsiListener) {
        const candidate = createGsiListener({ host: lanBindHost, port: next.gsiListener });
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
          host: lanBindHost,
          port: next.overlayHost,
          eventStream
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
        portConflicts.gsiListener = false;
      }
      if (nextHost !== null) {
        const previous = overlayHost;
        overlayHost = nextHost;
        await previous?.stop().catch(() => {});
        portConflicts.overlayHost = false;
      }

      ports = next;
      return { ok: true };
    };

    unregisterSettingsIpc = registerSettingsIpc(eventStream);
    unregisterFontsIpc = registerFontsIpc();
    unregisterNetworkIpc = registerNetworkIpc(
      networkSettingsStore,
      applyPorts,
      lanActive,
      portConflicts
    );
    unregisterGsiIpc = registerGsiIpc(networkSettingsStore, lanActive);
    unregisterKnownPlayersIpc = registerKnownPlayersIpc(knownPlayersStore, eventStream);
    unregisterFearlessDraftIpc = registerFearlessDraftIpc(
      fearlessStore,
      eventStream,
      notifyWatchedGamesChanged
    );
    unregisterPlayerRanksIpc = registerPlayerRanksIpc(playerRankStore);

    // Packaged builds serve the studio UI to the main window over loopback HTTP (see createMainWindow);
    // dev loads it from the Vite server instead, so the web host is only needed when packaged. Bind an
    // OS-assigned port (0), started after the user-configurable servers so it can never claim their
    // ports, and read the real one back when loading the window.
    if (app.isPackaged) {
      webHost = createWebHost({
        assetRoot: join(app.getAppPath(), 'build/web'),
        host: NETWORK_HOST,
        port: 0,
        eventStream
      });
      await webHost.start();
    }

    await createMainWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        void createMainWindow();
      }
    });
  })
  .catch((error: unknown) => {
    // The integration servers start non-fatally (a busy port is surfaced in the UI, not fatal), so
    // reaching here means the window itself could not be created, which is unrecoverable.
    logError('Observer Studio failed to start', error);
    dialog.showErrorBox(
      'Observer Studio could not start',
      'Observer Studio ran into an unexpected error while starting. See the logs for details.'
    );
    app.quit();
  });

function portInUseReason(port: number, error: unknown): string {
  logError(`Failed to bind port ${port}`, error);
  return `Port ${port} could not be bound. It may be in use by another app.`;
}

// Start an integration server, returning whether it bound. A busy port is logged but not thrown so
// the app still opens; the conflict is surfaced in the UI for the user to change the port.
async function startServer(server: { start(): Promise<void> }, port: number): Promise<boolean> {
  try {
    await server.start();
    return true;
  } catch (error) {
    logError(`Failed to bind port ${port}; the server is not running`, error);
    return false;
  }
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
  unregisterFearlessDraftIpc?.();
  unregisterNetworkIpc?.();
  unregisterGsiIpc?.();
  unregisterPlayerRanksIpc?.();
  closePlayerRankStore?.();
  closeKnownPlayersStore?.();
  gsiLiveness.stop();
  overlayGsiEventStream?.stop();

  void Promise.allSettled([
    gsiListener?.stop() ?? Promise.resolve(),
    overlayHost?.stop() ?? Promise.resolve(),
    webHost?.stop() ?? Promise.resolve()
  ]).finally(() => {
    app.quit();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
