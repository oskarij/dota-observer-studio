export const OVERLAY_ROUTE = '/overlay';

// Element ids referenced by the studio UI to branch on the selected component.
export const FEARLESS_DRAFT_ID = 'fearless-draft';

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
  {
    enabled: false,
    id: FEARLESS_DRAFT_ID,
    name: 'Fearless Draft'
  }
];
