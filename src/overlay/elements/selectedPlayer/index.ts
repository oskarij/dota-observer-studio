import type {
  DotaGsiData,
  DotaGsiTeamKey,
  SelectedDotaGsiPlayer
} from '../../../shared/gsi.js';
import { mmrToMedal, type PlayerProfile, type RankMedal } from './playerProfileData.js';
import { getPlayerProfile } from './playerProfiles.js';

import type { OverlayElement, OverlayElementContext } from '../../overlayElement.js';

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

export function mountSelectedPlayerElement(root: HTMLElement): OverlayElement {
  const team = getRequiredChild(root, '[data-selected-player-team]');
  const name = getRequiredChild(root, '[data-selected-player-name]');
  const medal = getRequiredImage(root, '[data-selected-player-medal]');
  const mmr = getRequiredChild(root, '[data-selected-player-mmr]');

  return {
    id: 'selected-player',
    setEnabled(enabled) {
      root.dataset.enabled = String(enabled);
    },
    update(_gsiData: DotaGsiData, context: OverlayElementContext) {
      if (root.dataset.enabled === 'false' || context.selectedPlayer === null) {
        root.dataset.visible = 'false';
        return;
      }

      renderSelectedPlayer({
        medal,
        mmr,
        name,
        profile: getPlayerProfile(context.selectedPlayer.player?.accountid),
        selectedPlayer: context.selectedPlayer,
        team
      });
      root.dataset.visible = 'true';
    }
  };
}

interface SelectedPlayerView {
  readonly medal: HTMLImageElement;
  readonly mmr: HTMLElement;
  readonly name: HTMLElement;
  readonly profile: PlayerProfile | null;
  readonly selectedPlayer: SelectedDotaGsiPlayer;
  readonly team: HTMLElement;
}

function renderSelectedPlayer(view: SelectedPlayerView): void {
  const mmr = view.profile?.mmr ?? null;
  const medal = mmrToMedal(mmr);

  view.team.textContent = `${formatTeamName(view.selectedPlayer.teamKey)} selected`;
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

function formatTeamName(teamKey: DotaGsiTeamKey): string {
  if (teamKey === 'team2') {
    return 'Radiant';
  }

  return 'Dire';
}

function formatMmr(mmr: number | null): string {
  if (mmr === null) {
    return 'MMR --';
  }

  return `${mmr} MMR`;
}

function formatMedalName(medal: RankMedal): string {
  return medal.charAt(0).toUpperCase() + medal.slice(1);
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
