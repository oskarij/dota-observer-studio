import type { DotaGsiData, SelectedDotaGsiPlayer } from '../shared/gsi.js';

export interface OverlayElementContext {
  readonly selectedPlayer: SelectedDotaGsiPlayer | null;
}

export interface OverlayElement {
  readonly id: string;
  setEnabled(enabled: boolean): void;
  update(gsiData: DotaGsiData, context: OverlayElementContext): void;
}
