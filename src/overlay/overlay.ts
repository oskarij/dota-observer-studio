import type { OverlayConfig } from '../shared/componentSettings.js';
import type { DotaGsiData } from '../shared/dotaGsiPayload.js';
import { GSI_STATUS_EVENT, type GsiStatus } from '../shared/gsiStatus.js';
import { logWarning } from '../shared/logger.js';
import { OVERLAY_REALTIME_EVENTS_URL } from '../shared/overlayEventStreamEndpoint.js';
import { OVERLAY_SETTINGS_EVENT } from '../shared/overlaySettingsEvent.js';

import { createOverlayStage } from './overlayStage.js';

import './overlay.css';

type RealtimeConnectionState = 'connected' | 'disconnected';

const OVERLAY_ROOT_ID = 'overlay-root';

const stage = createOverlayStage(getRequiredElement(OVERLAY_ROOT_ID));
const events = new EventSource(OVERLAY_REALTIME_EVENTS_URL);

events.onmessage = (event) => {
  const gsiData = parseGsiPayload(event.data);

  if (gsiData === null) {
    return;
  }

  stage.update(gsiData);
};

events.addEventListener(GSI_STATUS_EVENT, (event) => {
  applyGsiStatus((event as MessageEvent<string>).data);
});

events.addEventListener(OVERLAY_SETTINGS_EVENT, (event) => {
  applyOverlayConfig((event as MessageEvent<string>).data);
});

events.onopen = () => {
  setRealtimeConnectionState('connected');
};

events.onerror = () => {
  setRealtimeConnectionState('disconnected');
  // The stream itself dropped: no payloads are coming, so hide stale content.
  stage.clear();
};

window.addEventListener('beforeunload', () => {
  events.close();
  stage.destroy();
});

function applyGsiStatus(status: string): void {
  const gsiStatus: GsiStatus = status === 'live' ? 'live' : 'stale';
  document.documentElement.dataset.gsiStatus = gsiStatus;

  // On `live` the next payload re-renders elements; only `stale` needs an explicit hide.
  if (gsiStatus === 'stale') {
    stage.clear();
  }
}

function setRealtimeConnectionState(state: RealtimeConnectionState): void {
  document.documentElement.dataset.realtime = state;
}

function applyOverlayConfig(data: string): void {
  const config = parseOverlayConfig(data);

  if (config === null) {
    return;
  }

  for (const [id, enabled] of Object.entries(config.enabled)) {
    stage.setEnabled(id, enabled);
  }

  for (const [id, settings] of Object.entries(config.settings)) {
    stage.applySettings(id, settings);
  }
}

function parseOverlayConfig(data: string): OverlayConfig | null {
  try {
    return JSON.parse(data) as OverlayConfig;
  } catch (error) {
    logWarning('Discarded malformed overlay settings payload', error);
    return null;
  }
}

function parseGsiPayload(data: string): DotaGsiData | null {
  try {
    return JSON.parse(data) as DotaGsiData;
  } catch (error) {
    logWarning('Discarded malformed GSI payload', error);
    return null;
  }
}

function getRequiredElement(id: string): HTMLElement {
  const element = document.getElementById(id);

  if (!(element instanceof HTMLElement)) {
    throw new Error(`Missing overlay root element: ${id}`);
  }

  return element;
}
