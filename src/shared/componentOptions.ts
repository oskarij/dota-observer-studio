// Per-component behavioral (non-styling) options. Unlike ComponentSettings, which is the same
// shape for every element, each component type defines its own option shape — keyed by component
// id in OverlayConfig. Only components that have behavioral settings get an entry.

export type PlayerNameSource = 'profile' | 'ingame';
export type RankValueDisplay = 'mmr' | 'hidden';

export interface SelectedPlayerOptions {
  showName: boolean;
  // 'profile' prefers a known/pro name and falls back to the in-game name; 'ingame' always
  // shows the in-game name. Also acts as the live/unknown mode that drives the medal source.
  nameSource: PlayerNameSource;
  showMedal: boolean;
  rankValue: RankValueDisplay;
}

// Union of every component's option shape; today only Selected Player has options.
export type ComponentOptions = SelectedPlayerOptions;

export const SELECTED_PLAYER_ID = 'selected-player';

export function createDefaultSelectedPlayerOptions(): SelectedPlayerOptions {
  return { nameSource: 'profile', rankValue: 'mmr', showMedal: true, showName: true };
}

export function createDefaultComponentOptions(): Record<string, ComponentOptions> {
  return {
    [SELECTED_PLAYER_ID]: createDefaultSelectedPlayerOptions()
  };
}
