import { OVERLAY_ELEMENT_DEFINITIONS } from '../shared/overlay.js';

import { mountSelectedPlayerElement } from './elements/selectedPlayer/index.js';
import type { OverlayElement } from './overlayElement.js';

export interface OverlayElementRegistration {
  readonly enabled: boolean;
  readonly id: string;
  readonly mount: (root: HTMLElement) => OverlayElement;
  readonly name: string;
  readonly rootId: string;
}

export const overlayElementRegistry: OverlayElementRegistration[] = [
  {
    ...getElementDefinition('selected-player'),
    mount: mountSelectedPlayerElement,
    rootId: 'selected-player'
  }
];

function getElementDefinition(elementId: string): OverlayElementRegistrationDefinition {
  const definition = OVERLAY_ELEMENT_DEFINITIONS.find((element) => element.id === elementId);

  if (definition === undefined) {
    throw new Error(`Missing overlay element definition: ${elementId}`);
  }

  return definition;
}

interface OverlayElementRegistrationDefinition {
  readonly enabled: boolean;
  readonly id: string;
  readonly name: string;
}
