import { createDefaultComponentOptions, type ComponentOptions } from './componentOptions.js';
import { OVERLAY_ELEMENT_DEFINITIONS } from './overlayElementCatalog.js';

// General per-component overlay settings. Kept framework-agnostic so the overlay
// elements consume the same type in the studio preview and the live overlay.
// `position` is the top-left offset in stage (1920x1080) coordinates.
export interface ComponentSettings {
  position: { x: number; y: number };
  size: number; // scale percentage
  // weight is a CSS font-weight, italic toggles font-style; resolved by a bundled
  // @font-face for the overlay fonts and by the OS for system fonts.
  font: { family: string; weight: number; italic: boolean };
  color: string;
  shadow: { color: string; blur: number; offsetX: number; offsetY: number };
}

export function createDefaultComponentSettings(): ComponentSettings {
  return {
    // Top-left offset that reproduces the original bottom-left placement (~32px above
    // the 1080px floor); see selectedPlayer.css for the matching fallbacks.
    position: { x: 32, y: 994 },
    size: 100,
    font: { family: 'RadianceOverlay', weight: 600, italic: false },
    color: '#f8fbff',
    shadow: { color: '#000000', blur: 4, offsetX: 2, offsetY: 2 }
  };
}

// Per-component visibility + styling + behavioral options, persisted and broadcast to the live
// overlay as one unit.
export interface OverlayConfig {
  enabled: Record<string, boolean>;
  settings: Record<string, ComponentSettings>;
  options: Record<string, ComponentOptions>;
}

export function createDefaultOverlayConfig(): OverlayConfig {
  return {
    enabled: Object.fromEntries(
      OVERLAY_ELEMENT_DEFINITIONS.map((element) => [element.id, element.enabled])
    ),
    settings: Object.fromEntries(
      OVERLAY_ELEMENT_DEFINITIONS.map((element) => [element.id, createDefaultComponentSettings()])
    ),
    options: createDefaultComponentOptions()
  };
}
