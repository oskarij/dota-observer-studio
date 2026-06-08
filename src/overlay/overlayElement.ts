import type { DotaGsiData } from '../shared/dotaGsiPayload.js';

export interface OverlayElement {
  readonly id: string;
  destroy(): void;
  setEnabled(enabled: boolean): void;
  update(gsiData: DotaGsiData): void;
}
