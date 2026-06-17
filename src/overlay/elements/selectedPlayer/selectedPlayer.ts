import type { ComponentSettings } from '../../../shared/componentSettings.js';
import type { DotaGsiData, SelectedDotaGsiPlayer } from '../../../shared/dotaGsiPayload.js';
import { getSelectedDotaGsiPlayer } from '../../../shared/dotaGsiPayload.js';
import { mmrToMedal, type PlayerProfile, type RankMedal } from './playerProfileData.js';
import { getPlayerProfile } from './playerProfiles.js';
import { formatMedalName, formatMmr } from './selectedPlayerFormat.js';

import type { OverlayElement } from '../../overlayElement.js';

import ancientMedalUrl from './rankMedals/ancient.webp';
import archonMedalUrl from './rankMedals/archon.webp';
import crusaderMedalUrl from './rankMedals/crusader.webp';
import divineMedalUrl from './rankMedals/divine.webp';
import guardianMedalUrl from './rankMedals/guardian.webp';
import heraldMedalUrl from './rankMedals/herald.webp';
import immortalMedalUrl from './rankMedals/immortal.webp';
import legendMedalUrl from './rankMedals/legend.webp';
import './selectedPlayer.css';

const MEDAL_IMAGE_URLS: Record<RankMedal, string> = {
  ancient: ancientMedalUrl,
  archon: archonMedalUrl,
  crusader: crusaderMedalUrl,
  divine: divineMedalUrl,
  guardian: guardianMedalUrl,
  herald: heraldMedalUrl,
  immortal: immortalMedalUrl,
  legend: legendMedalUrl
};

export function mountSelectedPlayerElement(container: HTMLElement): OverlayElement {
  const root = createSelectedPlayerRoot();
  const name = getRequiredChild(root, '[data-selected-player-name]');
  const medal = getRequiredImage(root, '[data-selected-player-medal]');
  const mmr = getRequiredChild(root, '[data-selected-player-mmr]');

  container.append(root);

  return {
    id: 'selected-player',
    applySettings(settings: ComponentSettings) {
      applySelectedPlayerSettings(root, settings);
    },
    clear() {
      root.dataset.visible = 'false';
    },
    destroy() {
      root.remove();
    },
    setEnabled(enabled) {
      root.dataset.enabled = String(enabled);
    },
    update(gsiData: DotaGsiData) {
      const selectedPlayer = getSelectedDotaGsiPlayer(gsiData);

      if (root.dataset.enabled === 'false' || selectedPlayer === null) {
        root.dataset.visible = 'false';
        return;
      }

      renderSelectedPlayer({
        medal,
        mmr,
        name,
        profile: getPlayerProfile(selectedPlayer.player?.accountid),
        selectedPlayer
      });
      root.dataset.visible = 'true';
    }
  };
}

// Settings are applied as CSS custom properties so layout stays in CSS; the
// selectedPlayer.css fallbacks keep the default config a visual no-op.
function applySelectedPlayerSettings(root: HTMLElement, settings: ComponentSettings): void {
  const { shadow } = settings;
  const shadowValue = `0 0 ${shadow.blur}px ${shadow.color}, ${shadow.offsetX}px ${shadow.offsetY}px ${shadow.blur}px ${shadow.color}`;

  root.style.setProperty('--sp-x', `${settings.position.x}px`);
  root.style.setProperty('--sp-y', `${settings.position.y}px`);
  root.style.setProperty('--sp-scale', String(settings.size / 100));
  root.style.setProperty('--sp-color', settings.color);
  root.style.setProperty('--sp-font-family', settings.font.family);
  root.style.setProperty('--sp-font-weight', String(settings.font.weight));
  root.style.setProperty('--sp-shadow', shadowValue);
}

function createSelectedPlayerRoot(): HTMLElement {
  const root = document.createElement('section');
  root.id = 'selected-player';
  root.className = 'selected-player';
  root.dataset.enabled = 'true';
  root.dataset.visible = 'false';
  root.setAttribute('aria-live', 'polite');
  root.innerHTML = `
    <div class="selected-player__row">
      <span class="selected-player__name" data-selected-player-name>No selected player</span>
      <img alt="" class="selected-player__medal" data-selected-player-medal hidden />
      <span class="selected-player__mmr" data-selected-player-mmr>--</span>
    </div>
  `;

  return root;
}

interface SelectedPlayerView {
  readonly medal: HTMLImageElement;
  readonly mmr: HTMLElement;
  readonly name: HTMLElement;
  readonly profile: PlayerProfile | null;
  readonly selectedPlayer: SelectedDotaGsiPlayer;
}

function renderSelectedPlayer(view: SelectedPlayerView): void {
  const mmr = view.profile?.mmr ?? null;
  const medal = mmrToMedal(mmr);

  view.name.textContent =
    view.profile?.name ?? view.selectedPlayer.player?.name ?? view.selectedPlayer.playerKey;
  view.mmr.textContent = formatMmr(mmr);
  updateMedalImage(view.medal, medal);
}

function updateMedalImage(element: HTMLImageElement, medal: RankMedal | null): void {
  if (medal === null) {
    element.hidden = true;
    element.removeAttribute('src');
    element.alt = '';
    return;
  }

  element.hidden = false;
  element.src = MEDAL_IMAGE_URLS[medal];
  element.alt = `${formatMedalName(medal)} medal`;
}

function getRequiredChild(root: HTMLElement, selector: string): HTMLElement {
  const element = root.querySelector(selector);

  if (!(element instanceof HTMLElement)) {
    throw new Error(`Missing overlay element: ${selector}`);
  }

  return element;
}

function getRequiredImage(root: HTMLElement, selector: string): HTMLImageElement {
  const element = root.querySelector(selector);

  if (!(element instanceof HTMLImageElement)) {
    throw new Error(`Missing overlay image element: ${selector}`);
  }

  return element;
}
