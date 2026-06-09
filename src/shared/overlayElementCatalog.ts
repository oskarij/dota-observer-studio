export const OVERLAY_ROUTE = '/overlay';

export interface OverlayElementDefinition {
  readonly id: string;
  readonly enabled: boolean;
  readonly name: string;
}

export const OVERLAY_ELEMENT_DEFINITIONS: OverlayElementDefinition[] = [
  {
    enabled: true,
    id: 'selected-player',
    name: 'Selected Player'
  },
  // Placeholder entry until a real element is wired up — not yet in the overlay registry.
  {
    enabled: false,
    id: 'match-clock',
    name: 'Match Clock'
  }
];
