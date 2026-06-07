import type {
  DotaGsiData,
  DotaGsiTeamKey,
  SelectedDotaGsiHero
} from '../../../shared/gsi.js';

import type { OverlayElement, OverlayElementContext } from '../../overlayElement.js';

import './selectedUnit.css';

export function mountSelectedUnitElement(root: HTMLElement): OverlayElement {
  const team = getRequiredChild(root, '[data-selected-unit-team]');
  const hero = getRequiredChild(root, '[data-selected-unit-hero]');
  const player = getRequiredChild(root, '[data-selected-unit-player]');
  const level = getRequiredChild(root, '[data-selected-unit-level]');
  const health = getRequiredChild(root, '[data-selected-unit-health]');

  return {
    id: 'selected-unit',
    setEnabled(enabled) {
      root.dataset.enabled = String(enabled);
    },
    update(_gsiData: DotaGsiData, context: OverlayElementContext) {
      if (root.dataset.enabled === 'false' || context.selectedHero === null) {
        root.dataset.visible = 'false';
        return;
      }

      renderSelectedHero({
        health,
        hero,
        level,
        player,
        selectedHero: context.selectedHero,
        team
      });
      root.dataset.visible = 'true';
    }
  };
}

interface SelectedHeroView {
  readonly health: HTMLElement;
  readonly hero: HTMLElement;
  readonly level: HTMLElement;
  readonly player: HTMLElement;
  readonly selectedHero: SelectedDotaGsiHero;
  readonly team: HTMLElement;
}

function renderSelectedHero(view: SelectedHeroView): void {
  view.team.textContent = `${formatTeamName(view.selectedHero.teamKey)} selected`;
  view.hero.textContent = formatHeroName(view.selectedHero.hero.name);
  view.player.textContent = view.selectedHero.player?.name ?? view.selectedHero.heroKey;
  view.level.textContent = `Level ${view.selectedHero.hero.level ?? '--'}`;
  view.health.style.setProperty('--value', `${view.selectedHero.hero.health_percent ?? 0}%`);
}

function formatTeamName(teamKey: DotaGsiTeamKey): string {
  if (teamKey === 'team2') {
    return 'Radiant';
  }

  return 'Dire';
}

function formatHeroName(heroName: string | undefined): string {
  if (heroName === undefined || heroName.length === 0) {
    return 'Unknown hero';
  }

  return heroName
    .replace('npc_dota_hero_', '')
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function getRequiredChild(root: HTMLElement, selector: string): HTMLElement {
  const element = root.querySelector(selector);

  if (!(element instanceof HTMLElement)) {
    throw new Error(`Missing overlay element: ${selector}`);
  }

  return element;
}
