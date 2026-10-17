import type { ComponentOptions } from '../shared/componentOptions.js';
import type { ComponentSettings } from '../shared/componentSettings.js';
import type { DotaGsiData } from '../shared/dotaGsiPayload.js';
import type { FearlessSeriesPayload } from '../shared/fearlessDraft.js';
import type { KnownPlayer } from '../shared/knownPlayer.js';
import type { PlayerRank } from '../shared/overlayPlayerRankEvent.js';
import type { SeriesStatePayload } from '../shared/seriesState.js';

// Presentation behavior belongs to the surface, not to the persisted overlay configuration.
// OBS uses motion and a live clock; Studio uses still portraits and a frozen Sample clock.
export interface OverlayRenderOptions {
  readonly motion?: 'animated' | 'static';
  readonly clock?: 'live' | 'snapshot';
}

export interface OverlayElement {
  readonly id: string;
  // Optional: only elements that resolve names/MMR implement it.
  applyKnownPlayers?(players: readonly KnownPlayer[]): void;
  // Fearless ban pool pushed over SSE. Optional: only the fearless-draft element uses it.
  applyFearlessSeries?(payload: FearlessSeriesPayload): void;
  // Resolved series state (team names/logos/score) pushed over SSE. Optional: series-info elements only.
  applySeriesState?(payload: SeriesStatePayload): void;
  // Optional: only elements with non-styling settings implement it.
  applyOptions?(options: ComponentOptions): void;
  // OpenDota rank pushed over SSE. Optional: only elements that show a medal use it.
  applyPlayerRank?(rank: PlayerRank): void;
  applySettings(settings: ComponentSettings): void;
  // Hide the element because the GSI feed went stale or disconnected.
  clear(): void;
  destroy(): void;
  setEnabled(enabled: boolean): void;
  update(gsiData: DotaGsiData): void;
}
