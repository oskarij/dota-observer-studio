import type { ComponentOptions } from '../shared/componentOptions.js';
import type { ComponentSettings } from '../shared/componentSettings.js';
import type { DotaGsiData } from '../shared/dotaGsiPayload.js';
import type { KnownPlayer } from '../shared/knownPlayer.js';
import type { PlayerRank } from '../shared/overlayPlayerRankEvent.js';

export interface OverlayElement {
  readonly id: string;
  // Optional: only elements that resolve names/MMR implement it.
  applyKnownPlayers?(players: readonly KnownPlayer[]): void;
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
