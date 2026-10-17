import type { ComponentSettings } from '../../../shared/componentSettings.js';
import { DRAFT_GAME_STATES, type DotaGsiData } from '../../../shared/dotaGsiPayload.js';
import { getHero } from '../../../shared/heroes/heroCatalog.js';

import type { OverlayElement } from '../../overlayElement.js';
import { applyElementSettings } from '../../elementSettings.js';
import { getRequiredChild, setData } from '../../dom.js';

import { getHeroIconUrl } from './heroIcons.js';
import './fearlessDraft.css';

export function mountFearlessDraftElement(container: HTMLElement): OverlayElement {
  const root = createFearlessDraftRoot();
  const grid = getRequiredChild(root, '[data-fearless-grid]');

  // Heroes already played in the series.
  let bannedHeroIds: number[] = [];
  let inDraft = false;
  let poolChanged = true;

  container.append(root);

  // Hidden while the pool is empty, so the title never shows over an empty grid.
  function syncVisibility(): void {
    const shouldShow = root.dataset.enabled !== 'false' && inDraft && bannedHeroIds.length > 0;

    if (shouldShow && poolChanged) {
      grid.replaceChildren(...bannedHeroIds.map(createHeroCell));
      poolChanged = false;
    }

    setData(root, 'visible', String(shouldShow));
  }

  return {
    id: 'fearless-draft',
    applyFearlessSeries(payload) {
      if (
        bannedHeroIds.length !== payload.bannedHeroIds.length ||
        bannedHeroIds.some((id, index) => id !== payload.bannedHeroIds[index])
      ) {
        bannedHeroIds = [...payload.bannedHeroIds];
        poolChanged = true;
      }

      // A pool change shows without waiting for the next GSI tick.
      syncVisibility();
    },
    applySettings(settings: ComponentSettings) {
      applyElementSettings(root, settings);
    },
    clear() {
      inDraft = false;
      syncVisibility();
    },
    destroy() {
      root.remove();
    },
    setEnabled(enabled) {
      setData(root, 'enabled', String(enabled));
      syncVisibility();
    },
    update(gsiData: DotaGsiData) {
      const gameState = gsiData.map?.game_state;
      inDraft = gameState !== undefined && DRAFT_GAME_STATES.includes(gameState);
      syncVisibility();
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
    // Unknown hero or missing icon (a new hero before the assets are refreshed): show the name or
    // id instead of a broken image.
    const fallback = document.createElement('span');
    fallback.className = 'fearless-draft__fallback';
    fallback.textContent = hero?.localizedName ?? `#${heroId}`;
    cell.append(fallback);
  }

  return cell;
}

function createFearlessDraftRoot(): HTMLElement {
  const root = document.createElement('section');
  root.id = 'fearless-draft';
  root.className = 'overlay-element fearless-draft';
  root.dataset.enabled = 'true';
  root.dataset.visible = 'false';
  root.setAttribute('aria-live', 'polite');
  root.innerHTML = `
    <span class="fearless-draft__title">Fearless mode bans</span>
    <div class="fearless-draft__grid" data-fearless-grid></div>
  `;

  return root;
}
