import {
  createDefaultSelectedPlayerOptions,
  type PlayerNameSource,
  type SelectedPlayerOptions
} from '../../../shared/componentOptions.js';
import type { ComponentSettings } from '../../../shared/componentSettings.js';
import type { DotaGsiData, SelectedDotaGsiPlayer } from '../../../shared/dotaGsiPayload.js';
import { getSelectedDotaGsiPlayer } from '../../../shared/dotaGsiPayload.js';
import type { KnownPlayer } from '../../../shared/knownPlayer.js';
import { mmrToMedal, rankTierToMedal, type RankMedal } from './playerProfileData.js';
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

  let options = createDefaultSelectedPlayerOptions();
  // OpenDota ranks pushed over SSE, keyed by account id. Used for the medal in in-game mode, where
  // the player is treated as live/unknown and MMR isn't available.
  const rankTiersByAccountId = new Map<string, number | null>();
  // Curated name + MMR keyed by account id, pushed from the studio (SSE for the live overlay, the
  // IPC bridge for the preview). Drives "Known name" mode; empty until the first list arrives.
  let knownPlayersByAccountId = new Map<string, KnownPlayer>();

  container.append(root);

  return {
    id: 'selected-player',
    applyKnownPlayers(players) {
      knownPlayersByAccountId = new Map(players.map((player) => [player.accountId, player]));
    },
    applyOptions(nextOptions) {
      options = nextOptions;
    },
    applyPlayerRank(rank) {
      rankTiersByAccountId.set(rank.accountId, rank.rankTier);
    },
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

      const accountId = selectedPlayer.player?.accountid;

      renderSelectedPlayer(
        {
          medal,
          mmr,
          name,
          openDotaRankTier:
            accountId !== undefined ? (rankTiersByAccountId.get(accountId) ?? null) : null,
          profile:
            accountId !== undefined ? (knownPlayersByAccountId.get(accountId) ?? null) : null,
          selectedPlayer
        },
        options
      );
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
  root.style.setProperty('--sp-font-style', settings.font.italic ? 'italic' : 'normal');
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
  readonly openDotaRankTier: number | null;
  readonly profile: KnownPlayer | null;
  readonly selectedPlayer: SelectedDotaGsiPlayer;
}

function renderSelectedPlayer(view: SelectedPlayerView, options: SelectedPlayerOptions): void {
  const mmr = view.profile?.mmr ?? null;
  const medal = resolveMedal(view, options);

  if (options.showName) {
    view.name.hidden = false;
    view.name.textContent = resolveName(view, options.nameSource);
  } else {
    view.name.hidden = true;
    view.name.textContent = '';
  }

  // MMR is only known for curated profiles; in-game mode treats the player as live/unknown,
  // where MMR isn't public, so it is never shown regardless of the rank-value setting. When the
  // known-name mode falls back to the in-game name (no curated profile), there's no MMR to show
  // either — leave it blank rather than rendering a placeholder beside the bare name.
  const usingFallbackName = options.nameSource === 'profile' && view.profile === null;

  if (options.rankValue === 'hidden' || options.nameSource === 'ingame' || usingFallbackName) {
    view.mmr.hidden = true;
    view.mmr.textContent = '';
  } else {
    view.mmr.hidden = false;
    view.mmr.textContent = formatMmr(mmr);
  }

  updateMedalImage(view.medal, medal);
}

// Known-name mode derives the medal from the curated MMR; in-game mode treats the player as live
// and uses the OpenDota rank pushed over SSE. Either source can be absent (uncached, private, or
// unranked) — in which case we just show no medal.
function resolveMedal(view: SelectedPlayerView, options: SelectedPlayerOptions): RankMedal | null {
  if (!options.showMedal) {
    return null;
  }

  if (options.nameSource === 'ingame') {
    return rankTierToMedal(view.openDotaRankTier);
  }

  return mmrToMedal(view.profile?.mmr ?? null);
}

function resolveName(view: SelectedPlayerView, source: PlayerNameSource): string {
  const ingameName = view.selectedPlayer.player?.name ?? view.selectedPlayer.playerKey;

  if (source === 'ingame') {
    return ingameName;
  }

  return view.profile?.name ?? ingameName;
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
