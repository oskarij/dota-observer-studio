import type { DotaGsiData } from '../shared/dotaGsiPayload.js';
import { GSI_STATUS_EVENT, type GsiStatus } from '../shared/gsiStatus.js';
import { OVERLAY_REALTIME_EVENTS_URL } from '../shared/overlayEventStreamEndpoint.js';

import { overlayElementRegistry } from './elementRegistry.js';
import type { OverlayElement } from './overlayElement.js';

import './overlay.css';

type RealtimeConnectionState = 'connected' | 'disconnected';

const OVERLAY_ROOT_ID = 'overlay-root';

const overlayElements = mountOverlayElements();
const events = new EventSource(OVERLAY_REALTIME_EVENTS_URL);

events.onmessage = (event) => {
  const gsiData = parseGsiPayload(event.data);

  if (gsiData === null) {
    return;
  }

  for (const overlayElement of overlayElements) {
    overlayElement.update(gsiData);
  }
};

events.addEventListener(GSI_STATUS_EVENT, (event) => {
  applyGsiStatus((event as MessageEvent<string>).data);
});

events.onopen = () => {
  setRealtimeConnectionState('connected');
};

events.onerror = () => {
  setRealtimeConnectionState('disconnected');
  // The stream itself dropped: no payloads are coming, so hide stale content.
  clearOverlayElements();
};

window.addEventListener('beforeunload', () => {
  events.close();
  destroyOverlayElements(overlayElements);
});

function mountOverlayElements(): OverlayElement[] {
  const root = getRequiredElement(OVERLAY_ROOT_ID);

  return overlayElementRegistry.map((registration) => {
    const overlayElement = registration.mount(root);
    overlayElement.setEnabled(registration.enabled);

    return overlayElement;
  });
}

function destroyOverlayElements(elements: OverlayElement[]): void {
  for (const overlayElement of elements) {
    overlayElement.destroy();
  }
}

function clearOverlayElements(): void {
  for (const overlayElement of overlayElements) {
    overlayElement.clear();
  }
}

function applyGsiStatus(status: string): void {
  const gsiStatus: GsiStatus = status === 'live' ? 'live' : 'stale';
  document.documentElement.dataset.gsiStatus = gsiStatus;

  // On `live` the next payload re-renders elements; only `stale` needs an explicit hide.
  if (gsiStatus === 'stale') {
    clearOverlayElements();
  }
}

function setRealtimeConnectionState(state: RealtimeConnectionState): void {
  document.documentElement.dataset.realtime = state;
}

function parseGsiPayload(data: string): DotaGsiData | null {
  try {
    return JSON.parse(data) as DotaGsiData;
  } catch {
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
