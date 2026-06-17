import type { ComponentOptions } from '../shared/componentOptions.js';
import type { ComponentSettings } from '../shared/componentSettings.js';
import type { DotaGsiData } from '../shared/dotaGsiPayload.js';

import { overlayElementRegistry } from './elementRegistry.js';
import type { OverlayElement } from './overlayElement.js';

// Shared element lifecycle so the real overlay and the studio preview render the
// exact same elements. Intentionally does NOT import overlay.css (its transparent
// `html, body` rules belong only to the standalone overlay page).
export interface OverlayStage {
  applyOptions(id: string, options: ComponentOptions): void;
  applySettings(id: string, settings: ComponentSettings): void;
  clear(): void;
  destroy(): void;
  setEnabled(id: string, enabled: boolean): void;
  update(gsiData: DotaGsiData): void;
}

export function createOverlayStage(root: HTMLElement): OverlayStage {
  const elements: OverlayElement[] = overlayElementRegistry.map((registration) => {
    const overlayElement = registration.mount(root);
    overlayElement.setEnabled(registration.enabled);

    return overlayElement;
  });

  return {
    applyOptions(id, options) {
      for (const overlayElement of elements) {
        if (overlayElement.id === id) {
          overlayElement.applyOptions?.(options);
        }
      }
    },
    applySettings(id, settings) {
      for (const overlayElement of elements) {
        if (overlayElement.id === id) {
          overlayElement.applySettings(settings);
        }
      }
    },
    clear() {
      for (const overlayElement of elements) {
        overlayElement.clear();
      }
    },
    destroy() {
      for (const overlayElement of elements) {
        overlayElement.destroy();
      }
    },
    setEnabled(id, enabled) {
      for (const overlayElement of elements) {
        if (overlayElement.id === id) {
          overlayElement.setEnabled(enabled);
        }
      }
    },
    update(gsiData) {
      for (const overlayElement of elements) {
        overlayElement.update(gsiData);
      }
    }
  };
}
