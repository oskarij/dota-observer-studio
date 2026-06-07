import type { DotaGsiData } from '../shared/gsi.js';
import { getSelectedDotaGsiPlayer } from '../shared/gsi.js';
import { OVERLAY_REALTIME_EVENTS_URL } from '../shared/overlayRuntime.js';

import { overlayElementRegistry } from './elementRegistry.js';
import type { OverlayElement } from './overlayElement.js';

import './overlay.css';

type RealtimeConnectionState = 'connected' | 'disconnected';

const overlayElements = mountOverlayElements();
const events = new EventSource(OVERLAY_REALTIME_EVENTS_URL);

events.onmessage = (event) => {
  const gsiData = parseGsiPayload(event.data);

  if (gsiData === null) {
    return;
  }

  const context = {
    selectedPlayer: getSelectedDotaGsiPlayer(gsiData)
  };

  for (const overlayElement of overlayElements) {
    overlayElement.update(gsiData, context);
  }
};

events.onopen = () => {
  setRealtimeConnectionState('connected');
};

events.onerror = () => {
  setRealtimeConnectionState('disconnected');
};

function mountOverlayElements(): OverlayElement[] {
  return overlayElementRegistry.map((registration) => {
    const overlayElement = registration.mount(getRequiredElement(registration.rootId));
    overlayElement.setEnabled(registration.enabled);

    return overlayElement;
  });
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
