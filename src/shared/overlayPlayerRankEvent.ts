// SSE event name + payload for pushing a player's OpenDota rank to live-overlay clients,
// mirroring OVERLAY_SETTINGS_EVENT. The medal is derived from rankTier in the overlay (where the
// medal images live); a null rankTier means "checked, no public rank"; the overlay shows no medal.
export const OVERLAY_PLAYER_RANK_EVENT = 'player-rank';

export interface PlayerRank {
  readonly accountId: string;
  readonly rankTier: number | null;
}
