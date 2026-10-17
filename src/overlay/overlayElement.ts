import type { ComponentOptions } from '../shared/componentOptions.js';
import type { ComponentSettings } from '../shared/componentSettings.js';
import type { DotaGsiData } from '../shared/dotaGsiPayload.js';
import type { FearlessSeriesPayload } from '../shared/fearlessDraft.js';
import type { KnownPlayer } from '../shared/knownPlayer.js';
import type { PlayerRank } from '../shared/overlayEvents.js';
import type { SeriesStatePayload } from '../shared/seriesState.js';

// Presentation behavior belongs to the surface, not to the persisted overlay configuration.
// OBS uses motion and a live clock; Studio uses still portraits and a frozen Sample clock.
export interface OverlayRenderOptions {
  readonly motion?: 'animated' | 'static';
  readonly clock?: 'live' | 'snapshot';
}

export interface OverlayElement {
  readonly id: string;
  applyKnownPlayers?(players: readonly KnownPlayer[]): void;
  applyFearlessSeries?(payload: FearlessSeriesPayload): void;
  applySeriesState?(payload: SeriesStatePayload): void;
  applyOptions?(options: ComponentOptions): void;
  applyPlayerRank?(rank: PlayerRank): void;
  applySettings(settings: ComponentSettings): void;
  // Called when the GSI feed goes stale or disconnects.
  clear(): void;
  destroy(): void;
  setEnabled(enabled: boolean): void;
  update(gsiData: DotaGsiData): void;
}
