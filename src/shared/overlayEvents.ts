export const GSI_STATUS_EVENT = 'gsi-status';
export const OVERLAY_SETTINGS_EVENT = 'overlay-settings';
export const OVERLAY_KNOWN_PLAYERS_EVENT = 'overlay-known-players';
export const OVERLAY_FEARLESS_EVENT = 'overlay-fearless';
export const OVERLAY_SERIES_EVENT = 'overlay-series';
export const OVERLAY_PLAYER_RANK_EVENT = 'player-rank';

export interface PlayerRank {
  readonly accountId: string;
  // null: checked, no public rank.
  readonly rankTier: number | null;
}
