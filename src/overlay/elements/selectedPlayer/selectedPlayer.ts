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

  // MMR is only known for curated profiles; in-game mode treats the player as live/unknown,
  // where MMR isn't public, so it is never shown regardless of the rank-value setting. When the
  // known-name mode falls back to the in-game name (no curated profile), there's no MMR to show
  // either, so leave it blank rather than rendering a placeholder beside the bare name.
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

// Known-name mode derives the medal from the curated MMR; in-game mode treats the player as live
// and uses the OpenDota rank pushed over SSE. Either source can be absent (uncached, private, or
// unranked), in which case we just show no medal.
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
