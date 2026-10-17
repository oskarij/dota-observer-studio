import {
  createDefaultPlayerNamesOptions,
  isPlayerNamesOptions
} from '../../../shared/componentOptions.js';
import { DRAFT_GAME_STATES, type DotaGsiData } from '../../../shared/dotaGsiPayload.js';
import type { KnownPlayer } from '../../../shared/knownPlayer.js';
import type { PlayerNamesElement } from '../../../shared/overlayElementCatalog.js';
import { applyElementSettings } from '../../elementSettings.js';
import { setData, setHidden, setStyle } from '../../dom.js';
import type { OverlayElement } from '../../overlayElement.js';
import { getTeamPlayerNames } from './playerNamesData.js';

import './playerNames.css';

export function createPlayerNamesMount(
  element: PlayerNamesElement
): (container: HTMLElement) => OverlayElement {
  return (container) => {
    const root = document.createElement('section');
    root.id = element.id;
    root.className = 'overlay-element player-names';
    root.dataset.enabled = 'true';
    root.dataset.visible = 'false';
    root.dataset.side = element.side;
    root.setAttribute('aria-label', `${element.label} player names`);

    const rows = Array.from({ length: 5 }, () => {
      const row = document.createElement('div');
      row.className = 'player-names__name';
      row.hidden = true;
      root.append(row);
      return row;
    });
    container.append(root);

    let options = createDefaultPlayerNamesOptions();
    let knownPlayers = new Map<string, KnownPlayer>();
    let latestData: DotaGsiData | null = null;

    function render(): void {
      const gameState = latestData?.map?.game_state;
      const names =
        latestData === null || gameState === undefined || !DRAFT_GAME_STATES.includes(gameState)
          ? []
          : getTeamPlayerNames(
              latestData,
              element.side === 'radiant' ? 'team2' : 'team3',
              options.nameSource,
              knownPlayers
            );

      setData(
        root,
        'visible',
        String(root.dataset.enabled !== 'false' && names.some((name) => name !== ''))
      );
      rows.forEach((row, index) => {
        const name = names[index] ?? '';
        if (row.textContent !== name) {
          row.textContent = name;
        }
        setHidden(row, index >= names.length);
      });
    }

    return {
      id: element.id,
      applyKnownPlayers(players) {
        knownPlayers = new Map(players.map((player) => [player.accountId, player]));
        render();
      },
      applyOptions(next) {
        if (isPlayerNamesOptions(next)) {
          options = next;
          setStyle(root, '--pn-max-width', `${options.maxWidth}px`);
          render();
        }
      },
      applySettings(settings) {
        applyElementSettings(root, settings);
      },
      clear() {
        latestData = null;
        render();
      },
      destroy() {
        root.remove();
      },
      setEnabled(enabled) {
        setData(root, 'enabled', String(enabled));
        render();
      },
      update(gsiData) {
        latestData = gsiData;
        render();
      }
    };
  };
}
