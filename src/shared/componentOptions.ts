import { isRecord } from './validation.js';

import {
  DRAFT_BOARD_ID,
  PLAYER_NAMES_ELEMENTS,
  SERIES_INFO_ELEMENTS
} from './overlayElementCatalog.js';

export type PlayerNameSource = 'profile' | 'ingame';

export const NAME_SOURCE_LABELS: Record<PlayerNameSource, string> = {
  profile: 'Known name',
  ingame: 'In-game name'
};
export type RankValueDisplay = 'mmr' | 'hidden';

export interface SelectedPlayerOptions {
  showName: boolean;
  nameSource: PlayerNameSource;
  showMedal: boolean;
  rankValue: RankValueDisplay;
}

export interface DraftBoardOptions {
  showDuringStrategyTime: boolean;
}

export interface TeamNameOptions {
  maxWidth: number;
}

export interface PlayerNamesOptions extends TeamNameOptions {
  nameSource: PlayerNameSource;
}

export type ComponentOptions =
  | SelectedPlayerOptions
  | DraftBoardOptions
  | TeamNameOptions
  | PlayerNamesOptions;

export interface ComponentOptionsById {
  [id: string]: ComponentOptions | undefined;
  'selected-player'?: SelectedPlayerOptions;
  'draft-board'?: DraftBoardOptions;
  [id: `team-name-${string}`]: TeamNameOptions | undefined;
  [id: `player-names-${string}`]: PlayerNamesOptions | undefined;
}

export function isTeamNameId(id: string): id is `team-name-${string}` {
  return SERIES_INFO_ELEMENTS.some((element) => element.kind === 'team-name' && element.id === id);
}

export function isPlayerNamesId(id: string): id is `player-names-${string}` {
  return PLAYER_NAMES_ELEMENTS.some((element) => element.id === id);
}

export const SELECTED_PLAYER_ID = 'selected-player';

export function createDefaultSelectedPlayerOptions(): SelectedPlayerOptions {
  return { nameSource: 'profile', rankValue: 'mmr', showMedal: true, showName: true };
}

export function createDefaultDraftBoardOptions(): DraftBoardOptions {
  return { showDuringStrategyTime: true };
}

export const TEAM_NAME_MAX_WIDTH_RANGE = { min: 160, max: 1200, step: 10 } as const;

export function createDefaultTeamNameOptions(): TeamNameOptions {
  return { maxWidth: 640 };
}

export function createDefaultPlayerNamesOptions(): PlayerNamesOptions {
  return { maxWidth: 400, nameSource: 'profile' };
}

export function isPlayerNamesOptions(options: unknown): options is PlayerNamesOptions {
  return (
    isMaxWidthOptions(options) &&
    'nameSource' in options &&
    (options.nameSource === 'profile' || options.nameSource === 'ingame')
  );
}

export function isMaxWidthOptions(
  options: unknown
): options is TeamNameOptions | PlayerNamesOptions {
  return (
    isRecord(options) &&
    typeof options.maxWidth === 'number' &&
    Number.isFinite(options.maxWidth) &&
    options.maxWidth > 0
  );
}

export function isTeamNameOptions(options: unknown): options is TeamNameOptions {
  return isMaxWidthOptions(options) && !('nameSource' in options);
}

export function isDraftBoardOptions(options: unknown): options is DraftBoardOptions {
  return isRecord(options) && typeof options.showDuringStrategyTime === 'boolean';
}

export function isSelectedPlayerOptions(options: unknown): options is SelectedPlayerOptions {
  return (
    isRecord(options) &&
    typeof options.showName === 'boolean' &&
    typeof options.showMedal === 'boolean' &&
    (options.nameSource === 'profile' || options.nameSource === 'ingame') &&
    (options.rankValue === 'mmr' || options.rankValue === 'hidden')
  );
}

export function isOptionsFor(id: string, options: unknown): boolean {
  if (id === SELECTED_PLAYER_ID) return isSelectedPlayerOptions(options);
  if (id === DRAFT_BOARD_ID) return isDraftBoardOptions(options);
  if (isPlayerNamesId(id)) return isPlayerNamesOptions(options);
  if (isTeamNameId(id)) return isTeamNameOptions(options);
  return false;
}

export function createDefaultComponentOptions(): ComponentOptionsById {
  const options: ComponentOptionsById = {
    [SELECTED_PLAYER_ID]: createDefaultSelectedPlayerOptions(),
    [DRAFT_BOARD_ID]: createDefaultDraftBoardOptions()
  };

  for (const element of PLAYER_NAMES_ELEMENTS) {
    options[element.id] = createDefaultPlayerNamesOptions();
  }

  for (const element of SERIES_INFO_ELEMENTS) {
    if (element.kind === 'team-name') {
      options[element.id] = createDefaultTeamNameOptions();
    }
  }

  return options;
}
