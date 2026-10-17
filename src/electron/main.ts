import { app, BrowserWindow, dialog, ipcMain, Menu, session, shell } from 'electron';
import { createWriteStream } from 'node:fs';
import { mkdir, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { inspect } from 'node:util';

import { createKnownPlayersStore } from '../persistence/knownPlayersStore.js';
import { createPlayerRankStore } from '../persistence/playerRankStore.js';
import { createTeamsStore } from '../persistence/teamsStore.js';
import { createGsiListener } from '../runtime/gsiListener.js';
import { createGsiLiveness } from '../runtime/gsiLiveness.js';
import { createOverlayGsiEventStream } from '../runtime/overlayGsiEventStream.js';
import { createValveClient } from '../runtime/valveClient.js';
import { createOverlayHost } from '../runtime/overlayHost.js';
import { createPlayerRankService } from '../runtime/playerRankService.js';
import { createWebHost } from '../runtime/webHost.js';
import {
  APP_DIRTY_CHANGED_CHANNEL,
  APP_QUIT_CONFIRMED_CHANNEL,
  APP_SAVE_AND_QUIT_CHANNEL
} from '../shared/ipcChannels.js';
import { logError, logWarning, setLogSink } from '../shared/logger.js';
import { type ConfigurablePorts, LAN_BIND_HOST, NETWORK_HOST } from '../shared/networkConfig.js';

import { createFearlessStore } from './fearlessStore.js';
import { registerFontsIpc } from './ipc/fonts.js';
import { registerGsiIpc } from './ipc/gsi.js';
import { type ApplyPorts, registerNetworkIpc } from './ipc/network.js';
import { registerPlayerRanksIpc } from './ipc/playerRanks.js';
import { registerSettingsIpc } from './ipc/settings.js';
import { createNetworkSettingsStore } from './networkSettingsStore.js';
import { createSeriesStore } from './seriesStore.js';
import { registerStudioServices } from './studioServices.js';
import { createTournamentStore } from './tournamentStore.js';

app.setName('Observer Studio');

const STUDIO_CSP =
  "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; " +
  "img-src 'self' data:; font-src 'self' data:; connect-src 'self'; " +
  "object-src 'none'; base-uri 'none'; frame-ancestors 'none'";

let gsiListener: ReturnType<typeof createGsiListener> | null = null;
let overlayHost: ReturnType<typeof createOverlayHost> | null = null;
let webHost: ReturnType<typeof createWebHost> | null = null;
let overlayGsiEventStream: ReturnType<typeof createOverlayGsiEventStream> | null = null;
let unwireGsiListener: (() => void) | null = null;
const gsiLiveness = createGsiLiveness();

let rendererDirty = false;
let allowClose = false;
let confirmingClose = false;

ipcMain.on(APP_DIRTY_CHANGED_CHANNEL, (_event, dirty: boolean) => {
  rendererDirty = dirty;
});

ipcMain.on(APP_QUIT_CONFIRMED_CHANNEL, () => {
  allowClose = true;
  BrowserWindow.getAllWindows().forEach((window) => window.close());
});

async function confirmCloseWithUnsavedChanges(window: BrowserWindow): Promise<void> {
  if (confirmingClose) return;
  confirmingClose = true;
  try {
    const { response } = await dialog.showMessageBox(window, {
      type: 'warning',
      buttons: ['Save', "Don't Save", 'Cancel'],
      defaultId: 0,
      cancelId: 2,
      title: 'Save changes?',

      message: 'Save changes to the overlay layout before closing?',
      detail: "If you don't save, your changes will be lost."
    });

    if (response === 2) {
      return;
    }

    if (response === 1) {
      allowClose = true;
      window.close();
      return;
    }

    window.webContents.send(APP_SAVE_AND_QUIT_CHANNEL);
  } catch (error) {
    logError('Could not confirm closing the studio', error);
  } finally {
    confirmingClose = false;
  }
}

let unregisterSettingsIpc: (() => void) | null = null;
let unregisterFontsIpc: (() => void) | null = null;
let unregisterNetworkIpc: (() => void) | null = null;
let unregisterGsiIpc: (() => void) | null = null;
let unregisterPlayerRanksIpc: (() => void) | null = null;
let disposeStudioServices: (() => void) | null = null;
let unsubscribeGsiLiveness: (() => void) | null = null;
let closePlayerRankStore: (() => void) | null = null;
let closeKnownPlayersStore: (() => void) | null = null;
let closeTeamsStore: (() => void) | null = null;

function broadcastToWindows(channel: string): void {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send(channel);
  }
}

async function createMainWindow(): Promise<void> {
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

  window.webContents.on('preload-error', (_event, preloadPath, error) => {
    logError(`Preload failed to load: ${preloadPath}`, error);
  });

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
    const webHostPort = webHost?.port();
    if (webHostPort === null || webHostPort === undefined) {
      throw new Error('Web host is not running; cannot load the studio UI.');
    }

    await window.loadURL(`http://${NETWORK_HOST}:${webHostPort}/`);
    return;
  }

  window.webContents.openDevTools({ mode: 'detach' });
  await window.loadURL('http://127.0.0.1:5173');
}

app
  .whenReady()
  .then(async () => {
    await openLogFile();
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

    const networkSettingsStore = createNetworkSettingsStore();
    const networkSettings = networkSettingsStore.get();
    let ports = networkSettings.ports;
    const gsiToken = networkSettingsStore.gsiToken();
    const overlayAssetRoot = join(app.getAppPath(), 'build/overlay-assets/overlay');

    const lanActive = networkSettings.allowLanAccess;
    const lanBindHost = lanActive ? LAN_BIND_HOST : NETWORK_HOST;

    const eventStream = createOverlayGsiEventStream();
    overlayGsiEventStream = eventStream;
    unsubscribeGsiLiveness = gsiLiveness.onStatusChange((status) => {
      eventStream.setStatus(status);
      if (status === 'rejected')
        logWarning('Rejected GSI updates without the auth token; the GSI config is outdated');
    });
    eventStream.start();

    const knownPlayersStore = createKnownPlayersStore(
      join(app.getPath('userData'), 'known-players.db')
    );
    closeKnownPlayersStore = () => knownPlayersStore.close();

    const teamsStore = createTeamsStore(join(app.getPath('userData'), 'teams.db'));
    closeTeamsStore = () => teamsStore.close();
    const mediaRoot = join(app.getPath('userData'), 'media');

    const playerRankStore = createPlayerRankStore(join(app.getPath('userData'), 'player-ranks.db'));
    const playerRankService = createPlayerRankService({
      sink: eventStream,
      store: playerRankStore
    });
    closePlayerRankStore = () => {
      playerRankService.dispose();
      playerRankStore.close();
    };

    const fearlessStore = createFearlessStore();
    const tournamentStore = createTournamentStore();
    const valve = createValveClient(fetch, () => tournamentStore.getApiKey());
    const studio = registerStudioServices({
      eventStream,
      teams: teamsStore,
      players: knownPlayersStore,
      fearless: fearlessStore,
      series: createSeriesStore(),
      tournament: tournamentStore,
      valve,
      mediaRoot,
      broadcast: broadcastToWindows
    });
    const seriesSession = studio.session;
    disposeStudioServices = () => studio.dispose();

    const wireGsiListener = (listener: ReturnType<typeof createGsiListener>): (() => void) => {
      const unsubscribeBroadcast = listener.onPayload((payload) => {
        gsiLiveness.markAlive();
        eventStream.broadcast(payload);
      });
      const unsubscribeRank = listener.onPayload((payload) => {
        playerRankService.handlePayload(payload);
      });
      const unsubscribeSession = listener.onPayload((payload) =>
        seriesSession.handlePayload(payload)
      );
      const unsubscribeRejected = listener.onRejected(() => gsiLiveness.markRejected());

      return () => {
        unsubscribeBroadcast();
        unsubscribeRank();
        unsubscribeSession();
        unsubscribeRejected();
      };
    };

    const portConflicts = { overlayHost: false, gsiListener: false };

    gsiListener = createGsiListener({
      host: lanBindHost,
      port: ports.gsiListener,
      token: gsiToken
    });
    overlayHost = createOverlayHost({
      assetRoot: overlayAssetRoot,
      host: lanBindHost,
      port: ports.overlayHost,
      eventStream,
      mediaRoot
    });

    portConflicts.gsiListener = !(await startServer(gsiListener, ports.gsiListener));
    portConflicts.overlayHost = !(await startServer(overlayHost, ports.overlayHost));
    unwireGsiListener = wireGsiListener(gsiListener);

    const applyPorts: ApplyPorts = async (next: ConfigurablePorts) => {
      let nextListener: ReturnType<typeof createGsiListener> | null = null;
      let nextHost: ReturnType<typeof createOverlayHost> | null = null;

      if (next.gsiListener !== ports.gsiListener) {
        const candidate = createGsiListener({
          host: lanBindHost,
          port: next.gsiListener,
          token: gsiToken
        });
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
          eventStream,
          mediaRoot
        });
        try {
          await candidate.start();
          nextHost = candidate;
        } catch (error) {
          await candidate.stop().catch(() => {});

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

    unregisterSettingsIpc = registerSettingsIpc(eventStream, mediaRoot);
    unregisterFontsIpc = registerFontsIpc();
    unregisterNetworkIpc = registerNetworkIpc(
      networkSettingsStore,
      applyPorts,
      lanActive,
      portConflicts
    );
    unregisterGsiIpc = registerGsiIpc(networkSettingsStore, lanActive);

    unregisterPlayerRanksIpc = registerPlayerRanksIpc(playerRankStore, playerRankService);

    if (app.isPackaged) {
      webHost = createWebHost({
        assetRoot: join(app.getAppPath(), 'build/web'),
        host: NETWORK_HOST,
        port: 0,
        eventStream,
        mediaRoot
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
    logError('Observer Studio failed to start', error);
    dialog.showErrorBox(
      'Observer Studio could not start',
      `Observer Studio ran into an unexpected error while starting. Details are in ${join(app.getPath('logs'), 'main.log')}.`
    );
    app.quit();
  });

// Keeps this run's log and the previous run's in the logs folder (Settings → Open logs folder).
async function openLogFile(): Promise<void> {
  app.setAppLogsPath();
  const dir = app.getPath('logs');
  const path = join(dir, 'main.log');
  await mkdir(dir, { recursive: true });
  await rename(path, join(dir, 'main.old.log')).catch(() => {});
  const file = createWriteStream(path);
  file.once('error', () => setLogSink(null));
  setLogSink((level, message, detail) => {
    const suffix = detail === undefined ? '' : ` ${inspect(detail)}`;
    file.write(`${new Date().toISOString()} ${level.toUpperCase()} ${message}${suffix}\n`);
  });
}

function portInUseReason(port: number, error: unknown): string {
  logError(`Failed to bind port ${port}`, error);
  return `Port ${port} could not be bound. It may be in use by another app.`;
}

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
let shutdownComplete = false;

app.on('will-quit', (event) => {
  if (shutdownComplete) return;
  event.preventDefault();
  if (isShuttingDown) return;
  isShuttingDown = true;
  const cleanup = [
    unwireGsiListener,
    unsubscribeGsiLiveness,
    unregisterSettingsIpc,
    unregisterFontsIpc,
    unregisterNetworkIpc,
    unregisterGsiIpc,
    unregisterPlayerRanksIpc,
    disposeStudioServices,
    closePlayerRankStore,
    closeKnownPlayersStore,
    closeTeamsStore,
    () => gsiLiveness.stop(),
    () => overlayGsiEventStream?.stop(),
    () => gsiListener?.stop(),
    () => overlayHost?.stop(),
    () => webHost?.stop()
  ];
  void Promise.allSettled(cleanup.map((stop) => Promise.resolve().then(() => stop?.()))).then(
    (results) => {
      for (const result of results) {
        if (result.status === 'rejected')
          logError('Could not finish shutdown cleanup', result.reason);
      }
      shutdownComplete = true;
      // Let Electron finish cancelling this quit before requesting another.
      setImmediate(() => app.quit());
    }
  );
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
