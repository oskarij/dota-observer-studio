import type { ComponentOptions } from '../../../shared/componentOptions.js';
import { isTeamNameOptions } from '../../../shared/componentOptions.js';
import type { ComponentSettings } from '../../../shared/componentSettings.js';
import {
  DRAFT_GAME_STATES,
  type DotaGameState,
  type DotaGsiData
} from '../../../shared/dotaGsiPayload.js';
import type {
  SeriesInfoElement,
  SeriesInfoKind,
  SeriesInfoSide
} from '../../../shared/overlayElementCatalog.js';
import type { SeriesStatePayload } from '../../../shared/seriesState.js';

import type { OverlayElement } from '../../overlayElement.js';
import { applyElementSettings } from '../../elementSettings.js';
import { setData, setStyle } from '../../dom.js';

import './seriesInfo.css';

const INGAME_STATES: readonly DotaGameState[] = [
  'DOTA_GAMERULES_STATE_PRE_GAME',
  'DOTA_GAMERULES_STATE_GAME_IN_PROGRESS',
  'DOTA_GAMERULES_STATE_POST_GAME'
];

const DOM_KIND: Record<SeriesInfoKind, 'text' | 'logo'> = {
  'team-name': 'text',
  'team-logo': 'logo',
  'series-score': 'text'
};

function readValue(
  kind: SeriesInfoKind,
  side: SeriesInfoSide,
  payload: SeriesStatePayload
): string | null {
  const sideData = side === 'radiant' ? payload.radiant : payload.dire;
  if (kind === 'team-logo') {
    return sideData.logoPath;
  }
  if (kind === 'series-score') {
    // No placeholder 0–0 over casual spectating: the score renders only once a series actually
    // exists (both slots declared, or a live league ticket).
    return payload.seriesConfigured ? String(sideData.score) : null;
  }
  return sideData.name === '' ? null : sideData.name;
}

export function createSeriesInfoMount(
  element: SeriesInfoElement
): (container: HTMLElement) => OverlayElement {
  return (container) => mountSeriesInfoElement(container, element);
}

function mountSeriesInfoElement(
  container: HTMLElement,
  element: SeriesInfoElement
): OverlayElement {
  const domKind = DOM_KIND[element.kind];
  const scopeStates = element.scope === 'draft' ? DRAFT_GAME_STATES : INGAME_STATES;

  const root = document.createElement('section');
  root.id = element.id;
  root.className = `overlay-element series-info series-info--${domKind}`;
  root.dataset.enabled = 'true';
  root.dataset.visible = 'false';

  const content: HTMLElement =
    domKind === 'logo' ? document.createElement('img') : document.createElement('span');
  content.className = 'series-info__content';
  root.append(content);
  container.append(root);

  let seriesState: SeriesStatePayload | null = null;
  // Whether the live feed's game_state is inside this element's phase (draft or in-game).
  let inScope = false;

  function render(): void {
    const value = seriesState === null ? null : readValue(element.kind, element.side, seriesState);
    const visible = root.dataset.enabled !== 'false' && inScope && value !== null;
    setData(root, 'visible', String(visible));

    if (domKind === 'logo') {
      const img = content as HTMLImageElement;
      const src = value ?? '';
      if (img.getAttribute('src') !== src) {
        if (src === '') {
          img.removeAttribute('src');
        } else {
          img.src = src;
        }
      }
    } else if (content.textContent !== (value ?? '')) {
      content.textContent = value ?? '';
    }
  }

  return {
    id: element.id,
    applySeriesState(payload) {
      seriesState = payload;
      render();
    },
    applyOptions(next: ComponentOptions) {
      // Only the name readouts carry a width; the CSS falls back to unbounded for everything else.
      if (element.kind === 'team-name' && isTeamNameOptions(next)) {
        setStyle(root, '--si-max-width', `${String(next.maxWidth)}px`);
      }
    },
    applySettings(settings: ComponentSettings) {
      applyElementSettings(root, settings);
    },
    clear() {
      inScope = false;
      setData(root, 'visible', 'false');
    },
    destroy() {
      root.remove();
    },
    setEnabled(enabled) {
      setData(root, 'enabled', String(enabled));
      render();
    },
    update(gsiData: DotaGsiData) {
      const gameState = gsiData.map?.game_state;
      inScope = gameState !== undefined && scopeStates.includes(gameState);
      render();
    }
  };
}
