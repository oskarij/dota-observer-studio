import type { ComponentOptions, ComponentOptionsById } from '../shared/componentOptions.js';
import type { ComponentSettings, ElementBox } from '../shared/componentSettings.js';
import type { DotaGsiData } from '../shared/dotaGsiPayload.js';
import type { FearlessSeriesPayload } from '../shared/fearlessDraft.js';
import type { KnownPlayer } from '../shared/knownPlayer.js';
import type { OverlayPhase } from '../shared/overlayElementCatalog.js';
import type { PlayerRank } from '../shared/overlayEvents.js';
import type { SeriesStatePayload } from '../shared/seriesState.js';

import { overlayElementRegistry } from './elementRegistry.js';
import type { OverlayElement, OverlayRenderOptions } from './overlayElement.js';

export interface OverlayStage {
  applyFearlessSeries(payload: FearlessSeriesPayload): void;
  applySeriesState(payload: SeriesStatePayload): void;
  applyKnownPlayers(players: readonly KnownPlayer[]): void;
  applyOptions(id: string, options: ComponentOptions): void;
  applyPlayerRank(rank: PlayerRank): void;
  applySettings(id: string, settings: ComponentSettings): void;
  clear(): void;

  measure(id: string): ElementBox | null;
  destroy(): void;
  setEnabled(id: string, enabled: boolean): void;
  update(gsiData: DotaGsiData): void;
}

export function createOverlayStage(
  root: HTMLElement,
  phase: OverlayPhase | null = null,
  renderOptions: OverlayRenderOptions = {}
): OverlayStage {
  const elements: OverlayElement[] = overlayElementRegistry
    .filter((registration) => phase === null || registration.phase === phase)
    .map((registration) => {
      const overlayElement = registration.mount(root, renderOptions);
      overlayElement.setEnabled(registration.enabled);

      return overlayElement;
    });

  return {
    applyFearlessSeries(payload) {
      for (const overlayElement of elements) {
        overlayElement.applyFearlessSeries?.(payload);
      }
    },
    applySeriesState(payload) {
      for (const overlayElement of elements) {
        overlayElement.applySeriesState?.(payload);
      }
    },
    applyKnownPlayers(players) {
      for (const overlayElement of elements) {
        overlayElement.applyKnownPlayers?.(players);
      }
    },
    applyOptions(id, options) {
      for (const overlayElement of elements) {
        if (overlayElement.id === id) {
          overlayElement.applyOptions?.(options);
        }
      }
    },
    applyPlayerRank(rank) {
      for (const overlayElement of elements) {
        overlayElement.applyPlayerRank?.(rank);
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
    measure(id) {
      const node = root.querySelector<HTMLElement>(`#${CSS.escape(id)}`);
      if (node === null) {
        return null;
      }

      const stageRect = root.getBoundingClientRect();
      const scale = stageRect.width / root.offsetWidth;
      if (!Number.isFinite(scale) || scale <= 0) {
        return null;
      }

      const rect = node.getBoundingClientRect();
      return {
        x: (rect.left - stageRect.left) / scale,
        y: (rect.top - stageRect.top) / scale,
        width: rect.width / scale,
        height: rect.height / scale
      };
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

export function applyOverlayConfigToStage(
  stage: OverlayStage,
  config: {
    enabled?: Record<string, boolean> | undefined;
    settings?: Record<string, ComponentSettings> | undefined;
    options?: ComponentOptionsById | undefined;
  }
): void {
  for (const [id, enabled] of Object.entries(config.enabled ?? {})) {
    stage.setEnabled(id, enabled);
  }

  for (const [id, settings] of Object.entries(config.settings ?? {})) {
    stage.applySettings(id, settings);
  }

  for (const [id, options] of Object.entries(config.options ?? {})) {
    if (options !== undefined) stage.applyOptions(id, options);
  }
}
