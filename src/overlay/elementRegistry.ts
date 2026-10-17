import {
  OVERLAY_ELEMENT_DEFINITIONS,
  PLAYER_NAMES_ELEMENTS,
  type OverlayElementDefinition,
  SERIES_INFO_ELEMENTS
} from '../shared/overlayElementCatalog.js';

import { mountDraftBoardElement } from './elements/draftScreen/draftBoard.js';
import { mountFearlessDraftElement } from './elements/fearlessDraft/fearlessDraft.js';
import { mountSelectedPlayerElement } from './elements/selectedPlayer/selectedPlayer.js';
import { createPlayerNamesMount } from './elements/playerNames/playerNames.js';
import { createSeriesInfoMount } from './elements/seriesInfo/seriesInfo.js';
import type { OverlayElement, OverlayRenderOptions } from './overlayElement.js';

// The catalog definition (id, default visibility, phase) plus how to mount it; the stage picks the
// registrations for the phase its page serves.
export interface OverlayElementRegistration extends OverlayElementDefinition {
  readonly mount: (container: HTMLElement, options?: OverlayRenderOptions) => OverlayElement;
}

export const overlayElementRegistry: OverlayElementRegistration[] = [
  {
    ...getElementDefinition('selected-player'),
    mount: mountSelectedPlayerElement
  },
  {
    ...getElementDefinition('fearless-draft'),
    mount: mountFearlessDraftElement
  },
  {
    ...getElementDefinition('draft-board'),
    mount: mountDraftBoardElement
  },
  ...SERIES_INFO_ELEMENTS.map((element) => ({
    ...getElementDefinition(element.id),
    mount: createSeriesInfoMount(element)
  })),
  ...PLAYER_NAMES_ELEMENTS.map((element) => ({
    ...getElementDefinition(element.id),
    mount: createPlayerNamesMount(element)
  }))
];

function getElementDefinition(elementId: string): OverlayElementDefinition {
  const definition = OVERLAY_ELEMENT_DEFINITIONS.find((element) => element.id === elementId);

  if (definition === undefined) {
    throw new Error(`Missing overlay element definition: ${elementId}`);
  }

  return definition;
}
