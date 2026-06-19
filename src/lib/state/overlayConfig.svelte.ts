import type { ComponentOptions } from '../../shared/componentOptions.js';
import {
  createDefaultComponentSettings,
  createDefaultOverlayConfig,
  type ComponentSettings,
  type OverlayConfig
} from '../../shared/componentSettings.js';
import { logWarning } from '../../shared/logger.js';

const BRIDGE_UNAVAILABLE =
  'Settings bridge unavailable (window.dotaSpectatorTools.settings missing). Changes will not persist. Expected the Electron preload to expose it.';

// Single source of truth for per-component visibility + settings. Edits mutate a working copy
// that the studio preview reads reactively (immediate), while persistence + the live-overlay
// broadcast happen only on save(). discard() rolls the working copy back to the last saved state.
export class OverlayConfigStore {
  #enabled = $state<Record<string, boolean>>({});
  #settings = $state<Record<string, ComponentSettings>>({});
  #options = $state<Record<string, ComponentOptions>>({});
  // Last saved/loaded config as JSON, for dirty detection and discard.
  #saved = $state('');
  #dirty = $derived(this.#currentJson() !== this.#saved);

  constructor() {
    this.#apply(createDefaultOverlayConfig());
  }

  get enabled(): Record<string, boolean> {
    return this.#enabled;
  }

  get settings(): Record<string, ComponentSettings> {
    return this.#settings;
  }

  get options(): Record<string, ComponentOptions> {
    return this.#options;
  }

  get dirty(): boolean {
    return this.#dirty;
  }

  async load(): Promise<void> {
    if (this.#api === undefined) {
      logWarning(BRIDGE_UNAVAILABLE);
      return;
    }

    this.#apply(await this.#api.get());
  }

  async save(): Promise<void> {
    if (this.#api === undefined) {
      // Don't clear the dirty flag: the user must see the save did not take.
      logWarning(BRIDGE_UNAVAILABLE);
      return;
    }

    const config = this.#current();
    await this.#api.set(config);
    this.#saved = JSON.stringify(config);
  }

  discard(): void {
    this.#apply(JSON.parse(this.#saved) as OverlayConfig);
  }

  resetComponent(id: string): void {
    this.#settings[id] = createDefaultComponentSettings();
  }

  get #api() {
    return globalThis.window?.dotaSpectatorTools?.settings;
  }

  #current(): OverlayConfig {
    return {
      enabled: $state.snapshot(this.#enabled),
      settings: $state.snapshot(this.#settings),
      options: $state.snapshot(this.#options)
    };
  }

  #currentJson(): string {
    return JSON.stringify(this.#current());
  }

  #apply(config: OverlayConfig): void {
    this.#enabled = config.enabled;
    this.#settings = config.settings;
    this.#options = config.options;
    this.#saved = JSON.stringify(config);
  }
}

// Shared across the app so the Overlay and Components pages edit one working copy and the
// app-wide Save/Discard bar reflects a single dirty state. Loaded once from the layout.
export const overlayConfig = new OverlayConfigStore();
