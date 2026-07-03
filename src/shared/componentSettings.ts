import { createDefaultComponentOptions, type ComponentOptions } from './componentOptions.js';
import { OVERLAY_ELEMENT_DEFINITIONS } from './overlayElementCatalog.js';

// Per-component overlay settings; framework-agnostic so the studio preview and live overlay
// share the type. `position` is the top-left offset in stage (1920x1080) coordinates.
export interface ComponentSettings {
  position: { x: number; y: number };
  size: number; // scale percentage
  // weight is a CSS font-weight, italic toggles font-style; resolved by a bundled
  // @font-face for the overlay fonts and by the OS for system fonts.
  font: { family: string; weight: number; italic: boolean };
  color: string;
  shadow: { color: string; blur: number; offsetX: number; offsetY: number };
}

// Per-element starting position overrides. The shared default suits a single bottom-left readout
// (selected-player); other elements want a different anchor (the fearless grid sits near the top so
// it can grow downward), so they override just the bits that differ.
const COMPONENT_SETTINGS_OVERRIDES: Record<string, Partial<ComponentSettings>> = {
  'fearless-draft': { position: { x: 510, y: 25 } }
};

export function createDefaultComponentSettings(id?: string): ComponentSettings {
  const base: ComponentSettings = {
    position: { x: 545, y: 852 },
    size: 100,
    font: { family: 'RadianceOverlay', weight: 600, italic: false },
    color: '#f8fbff',
    shadow: { color: '#000000', blur: 4, offsetX: 2, offsetY: 2 }
  };

  const override = id === undefined ? undefined : COMPONENT_SETTINGS_OVERRIDES[id];
  return override === undefined ? base : { ...base, ...override };
}

// Per-component visibility + styling + behavioral options, persisted and broadcast as one unit.
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
      OVERLAY_ELEMENT_DEFINITIONS.map((element) => [
        element.id,
        createDefaultComponentSettings(element.id)
      ])
    ),
    options: createDefaultComponentOptions()
  };
}

// Minimal structural check for a config crossing a trust/process boundary (an imported file or an
// SSE payload). The field-level merge over defaults fills in anything missing afterward.
export function isOverlayConfigShape(value: unknown): value is OverlayConfig {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    isPlainObject(candidate.enabled) &&
    isPlainObject(candidate.settings) &&
    isPlainObject(candidate.options)
  );
}

function isPlainObject(value: unknown): boolean {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
