import {
  createDefaultSelectedPlayerOptions,
  isSelectedPlayerOptions,
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
import { applyElementSettings } from '../../elementSettings.js';
import { getRequiredChild, setData, setHidden, setText } from '../../dom.js';

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
  // OpenDota rank tiers by account id, for the medal in in-game name mode.
  const rankTiersByAccountId = new Map<string, number | null>();
  // Curated names and MMR by account id, for known-name mode.
  let knownPlayersByAccountId = new Map<string, KnownPlayer>();

  container.append(root);

  return {
    id: 'selected-player',
    applyKnownPlayers(players) {
      knownPlayersByAccountId = new Map(players.map((player) => [player.accountId, player]));
    },
    applyOptions(nextOptions) {
      // The stage addresses options by element id, but the type is the all-components union.
      if (isSelectedPlayerOptions(nextOptions)) {
        options = nextOptions;
      }
    },
    applyPlayerRank(rank) {
      rankTiersByAccountId.set(rank.accountId, rank.rankTier);
    },
    applySettings(settings: ComponentSettings) {
      applyElementSettings(root, settings);
    },
    clear() {
      setData(root, 'visible', 'false');
    },
    destroy() {
      root.remove();
    },
    setEnabled(enabled) {
      setData(root, 'enabled', String(enabled));
    },
    update(gsiData: DotaGsiData) {
      const selectedPlayer =
        root.dataset.enabled === 'false' ? null : getSelectedDotaGsiPlayer(gsiData);

      if (root.dataset.enabled === 'false' || selectedPlayer === null) {
        setData(root, 'visible', 'false');
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
      setData(root, 'visible', 'true');
    }
  };
}

function createSelectedPlayerRoot(): HTMLElement {
  const root = document.createElement('section');
  root.id = 'selected-player';
  root.className = 'overlay-element selected-player';
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
    setHidden(view.name, false);
    setText(view.name, resolveName(view, options.nameSource));
  } else {
    setHidden(view.name, true);
    setText(view.name, '');
  }

  // Only a curated profile has MMR, so it stays hidden in in-game mode and when known-name mode
  // falls back to the in-game name.
  const usingFallbackName = options.nameSource === 'profile' && view.profile === null;

  if (options.rankValue === 'hidden' || options.nameSource === 'ingame' || usingFallbackName) {
    setHidden(view.mmr, true);
    setText(view.mmr, '');
  } else {
    setHidden(view.mmr, false);
    setText(view.mmr, formatMmr(mmr));
  }

  updateMedalImage(view.medal, medal);
}

// Known-name mode uses the curated MMR, in-game mode the OpenDota rank. No value, no medal.
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
    setHidden(element, true);
    if (element.hasAttribute('src')) element.removeAttribute('src');
    if (element.alt !== '') element.alt = '';
    return;
  }

  setHidden(element, false);
  if (element.getAttribute('src') !== MEDAL_IMAGE_URLS[medal])
    element.src = MEDAL_IMAGE_URLS[medal];
  const label = `${formatMedalName(medal)} medal`;
  if (element.alt !== label) element.alt = label;
}

function getRequiredImage(root: HTMLElement, selector: string): HTMLImageElement {
  const element = root.querySelector(selector);

  if (!(element instanceof HTMLImageElement)) {
    throw new Error(`Missing overlay image element: ${selector}`);
  }

  return element;
}
