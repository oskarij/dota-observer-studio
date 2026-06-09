// General per-component overlay settings. Kept framework-agnostic so the overlay
// elements can consume the same type once these are wired into the live preview.
// Defaults mirror the current hardcoded CSS so future wiring is a no-op at rest.
export interface ComponentSettings {
  position: { x: number; y: number };
  size: number; // scale percentage
  font: { family: string; weight: number };
  color: string;
  shadow: { color: string; blur: number; offsetX: number; offsetY: number };
}

export function createDefaultComponentSettings(): ComponentSettings {
  return {
    position: { x: 32, y: 32 },
    size: 100,
    font: { family: 'RadianceOverlay', weight: 700 },
    color: '#f8fbff',
    shadow: { color: '#000000', blur: 4, offsetX: 2, offsetY: 2 }
  };
}
