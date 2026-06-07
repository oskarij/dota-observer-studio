import type { DotaGsiData, SelectedDotaGsiHero } from '../shared/gsi.js';

export interface OverlayElementContext {
  readonly selectedHero: SelectedDotaGsiHero | null;
}

export interface OverlayElement {
  readonly id: string;
  setEnabled(enabled: boolean): void;
  update(gsiData: DotaGsiData, context: OverlayElementContext): void;
}
