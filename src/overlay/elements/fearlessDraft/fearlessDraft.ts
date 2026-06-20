import type { ComponentSettings } from '../../../shared/componentSettings.js';
import type { DotaGsiData } from '../../../shared/dotaGsiPayload.js';
import { getHero } from '../../../shared/heroes/heroCatalog.js';

import type { OverlayElement } from '../../overlayElement.js';

import { getHeroIconUrl } from './heroIcons.js';
import './fearlessDraft.css';

// Only shown during the draft. Captains Mode runs the whole pick/ban phase in HERO_SELECTION; the
// in-game overlay takes over at GAME_IN_PROGRESS, so the two never overlap.
const DRAFT_GAME_STATE = 'DOTA_GAMERULES_STATE_HERO_SELECTION';

export function mountFearlessDraftElement(container: HTMLElement): OverlayElement {
  const root = createFearlessDraftRoot();
  const grid = getRequiredChild(root, '[data-fearless-grid]');

  // The fearless ban pool (heroes already played in the series), pushed from the studio over SSE
  // for the live overlay and via the stage for the preview. Empty until the first payload arrives.
  let bannedHeroIds: number[] = [];
  let visible = false;

  container.append(root);

  function renderGrid(): void {
    grid.replaceChildren(...bannedHeroIds.map(createHeroCell));
  }

  return {
    id: 'fearless-draft',
    applyFearlessSeries(payload) {
      bannedHeroIds = payload.bannedHeroIds;

      // Rebuild now so a series edit reflects immediately while the grid is on screen.
      if (visible) {
        renderGrid();
      }
    },
    applySettings(settings: ComponentSettings) {
      applyFearlessDraftSettings(root, settings);
    },
    clear() {
      visible = false;
      root.dataset.visible = 'false';
    },
    destroy() {
      root.remove();
    },
    setEnabled(enabled) {
      root.dataset.enabled = String(enabled);
    },
    update(gsiData: DotaGsiData) {
      const shouldShow =
        root.dataset.enabled !== 'false' && gsiData.map?.game_state === DRAFT_GAME_STATE;

      if (!shouldShow) {
        visible = false;
        root.dataset.visible = 'false';
        return;
      }

      // Becoming visible (or staying visible): render the current pool. Cheap — a handful of nodes.
      renderGrid();
      visible = true;
      root.dataset.visible = 'true';
    }
  };
}

function createHeroCell(heroId: number): HTMLElement {
  const hero = getHero(heroId);
  const iconUrl = hero === undefined ? null : getHeroIconUrl(hero.internalName);

  const cell = document.createElement('div');
  cell.className = 'fearless-draft__hero';

  if (iconUrl !== null && hero !== undefined) {
    const img = document.createElement('img');
    img.className = 'fearless-draft__icon';
    img.src = iconUrl;
    img.alt = hero.localizedName;
    cell.append(img);
  } else {
    // Unknown id or missing icon (e.g. a brand-new hero before assets are refreshed): show the
    // name (or raw id) rather than a broken image so the slot is still accounted for.
    const fallback = document.createElement('span');
    fallback.className = 'fearless-draft__fallback';
    fallback.textContent = hero?.localizedName ?? `#${heroId}`;
    cell.append(fallback);
  }

  return cell;
}

// Settings are applied as CSS custom properties so layout stays in CSS; the fearlessDraft.css
// fallbacks keep the default config a visual no-op.
function applyFearlessDraftSettings(root: HTMLElement, settings: ComponentSettings): void {
  const { shadow } = settings;
  const shadowValue = `0 0 ${shadow.blur}px ${shadow.color}, ${shadow.offsetX}px ${shadow.offsetY}px ${shadow.blur}px ${shadow.color}`;

  root.style.setProperty('--fd-x', `${settings.position.x}px`);
  root.style.setProperty('--fd-y', `${settings.position.y}px`);
  root.style.setProperty('--fd-scale', String(settings.size / 100));
  root.style.setProperty('--fd-color', settings.color);
  root.style.setProperty('--fd-font-family', settings.font.family);
  root.style.setProperty('--fd-font-weight', String(settings.font.weight));
  root.style.setProperty('--fd-font-style', settings.font.italic ? 'italic' : 'normal');
  root.style.setProperty('--fd-shadow', shadowValue);
}

function createFearlessDraftRoot(): HTMLElement {
  const root = document.createElement('section');
  root.id = 'fearless-draft';
  root.className = 'fearless-draft';
  root.dataset.enabled = 'true';
  root.dataset.visible = 'false';
  root.setAttribute('aria-live', 'polite');
  root.innerHTML = `
    <span class="fearless-draft__title">Fearless mode bans</span>
    <div class="fearless-draft__grid" data-fearless-grid></div>
  `;

  return root;
}

function getRequiredChild(root: HTMLElement, selector: string): HTMLElement {
  const element = root.querySelector(selector);

  if (!(element instanceof HTMLElement)) {
    throw new Error(`Missing overlay element: ${selector}`);
  }

  return element;
}
