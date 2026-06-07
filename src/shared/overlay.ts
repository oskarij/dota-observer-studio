export const OVERLAY_ROUTE = '/overlay';

export interface OverlayElementDefinition {
  readonly id: string;
  readonly enabled: boolean;
  readonly name: string;
}

export const OVERLAY_ELEMENT_DEFINITIONS: OverlayElementDefinition[] = [
  {
    enabled: true,
    id: 'selected-unit',
    name: 'Selected Unit'
  }
];
