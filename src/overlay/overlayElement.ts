import type { DotaGsiData } from '../shared/gsi.js';

export interface OverlayElement {
  readonly id: string;
  destroy(): void;
  setEnabled(enabled: boolean): void;
  update(gsiData: DotaGsiData): void;
}
