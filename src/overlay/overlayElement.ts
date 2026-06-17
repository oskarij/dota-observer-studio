import type { ComponentSettings } from '../shared/componentSettings.js';
import type { DotaGsiData } from '../shared/dotaGsiPayload.js';

export interface OverlayElement {
  readonly id: string;
  applySettings(settings: ComponentSettings): void;
  /** Hide the element because the GSI feed went stale or disconnected. */
  clear(): void;
  destroy(): void;
  setEnabled(enabled: boolean): void;
  update(gsiData: DotaGsiData): void;
}
