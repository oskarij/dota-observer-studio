import type { OverlayConfig } from '../shared/componentSettings.js';
import type { GsiStatus } from '../shared/gsiStatus.js';
import type { DotaGsiData } from '../shared/dotaGsiPayload.js';
import { resolveOverlayPhaseFromPath } from '../shared/overlayRoutes.js';
import { connectOverlayRealtime, type RealtimeConnectionState } from './overlayRealtimeClient.js';

import { applyOverlayConfigToStage, createOverlayStage } from './overlayStage.js';

import './overlay.css';

const OVERLAY_ROOT_ID = 'overlay-root';

// Which Browser source this page is: /overlay/draft/ and /overlay/ingame/ mount only their own
// phase's elements, so OBS can layer each over its matching scene; the bare /overlay/ mounts all.
const phase = resolveOverlayPhaseFromPath(window.location.pathname);

const stage = createOverlayStage(getRequiredElement(OVERLAY_ROOT_ID), phase);
// Last in <head>, so the operator's CSS wins over the bundled styles at equal specificity. Not
// wrapped in @scope: OBS 30's browser (Chromium 103) drops @scope rules.
const customCss = document.head.appendChild(document.createElement('style'));
customCss.id = 'custom-css';
let latestData: DotaGsiData | null = null;
function renderLatest(): void {
  if (latestData !== null && !document.hidden) stage.update(latestData);
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) stage.clear();
  else renderLatest();
});
const disconnect = connectOverlayRealtime({
  onGsiData(gsiData) {
    latestData = gsiData;
    renderLatest();
  },
  onStatus: applyGsiStatus,
  onSettings: applyOverlayConfig,
  onKnownPlayers(players) {
    stage.applyKnownPlayers(players);
    renderLatest();
  },
  onFearlessSeries(payload) {
    stage.applyFearlessSeries(payload);
    renderLatest();
  },
  onSeriesState(payload) {
    stage.applySeriesState(payload);
    renderLatest();
  },
  onPlayerRank(rank) {
    stage.applyPlayerRank(rank);
    renderLatest();
  },
  onConnectionChange(state) {
    setRealtimeConnectionState(state);

    // The stream itself dropped: no payloads are coming, so hide stale content.
    if (state === 'disconnected') {
      latestData = null;
      stage.clear();
    }
  }
});

window.addEventListener('beforeunload', () => {
  disconnect();
  stage.destroy();
});

function applyGsiStatus(status: GsiStatus): void {
  document.documentElement.dataset.gsiStatus = status;

  // On `live` the next payload re-renders elements; any other status hides them.
  if (status !== 'live') {
    latestData = null;
    stage.clear();
  }
}

function setRealtimeConnectionState(state: RealtimeConnectionState): void {
  document.documentElement.dataset.realtime = state;
}

function applyOverlayConfig(config: OverlayConfig): void {
  applyOverlayConfigToStage(stage, config);
  if (customCss.textContent !== config.customCss) customCss.textContent = config.customCss;
  renderLatest();
}

function getRequiredElement(id: string): HTMLElement {
  const element = document.getElementById(id);

  if (!(element instanceof HTMLElement)) {
    throw new Error(`Missing overlay root element: ${id}`);
  }

  return element;
}
