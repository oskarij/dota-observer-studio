import type { OverlayConfig } from '../shared/componentSettings.js';
import type { GsiStatus } from '../shared/gsiStatus.js';
import {
  connectOverlayRealtime,
  type RealtimeConnectionState
} from './overlayRealtimeClient.js';

import { createOverlayStage } from './overlayStage.js';

import './overlay.css';

const OVERLAY_ROOT_ID = 'overlay-root';

const stage = createOverlayStage(getRequiredElement(OVERLAY_ROOT_ID));
const disconnect = connectOverlayRealtime({
  onGsiData(gsiData) {
    stage.update(gsiData);
  },
  onStatus: applyGsiStatus,
  onSettings: applyOverlayConfig,
  onPlayerRank(rank) {
    // The medal is keyed by account id and applied on the next GSI payload for that player.
    stage.applyPlayerRank(rank);
  },
  onConnectionChange(state) {
    setRealtimeConnectionState(state);

    // The stream itself dropped: no payloads are coming, so hide stale content.
    if (state === 'disconnected') {
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

  // On `live` the next payload re-renders elements; only `stale` needs an explicit hide.
  if (status === 'stale') {
    stage.clear();
  }
}

function setRealtimeConnectionState(state: RealtimeConnectionState): void {
  document.documentElement.dataset.realtime = state;
}

function applyOverlayConfig(config: OverlayConfig): void {
  for (const [id, enabled] of Object.entries(config.enabled)) {
    stage.setEnabled(id, enabled);
  }

  for (const [id, settings] of Object.entries(config.settings)) {
    stage.applySettings(id, settings);
  }

  // Options change content (name source, medal/MMR visibility), so they take effect on the
  // next GSI payload — which streams continuously during a live game.
  for (const [id, options] of Object.entries(config.options)) {
    stage.applyOptions(id, options);
  }
}

function getRequiredElement(id: string): HTMLElement {
  const element = document.getElementById(id);

  if (!(element instanceof HTMLElement)) {
    throw new Error(`Missing overlay root element: ${id}`);
  }

  return element;
}
