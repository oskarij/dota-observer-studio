import { errorMessage } from '../../shared/result.js';
import type { ComponentOptionsById } from '../../shared/componentOptions.js';
import {
  createDefaultComponentSettings,
  createDefaultOverlayConfig,
  mergeOverlayConfigDefaults,
  type ComponentSettings,
  type OverlayConfig
} from '../../shared/componentSettings.js';
import { logWarning } from '../../shared/logger.js';

const BRIDGE_UNAVAILABLE =
  'Settings bridge unavailable (window.dotaSpectatorTools.settings missing). Changes will not persist. Expected the Electron preload to expose it.';

export class OverlayConfigStore {
  error = $state<string | null>(null);
  #enabled = $state<Record<string, boolean>>({});
  #settings = $state<Record<string, ComponentSettings>>({});
  #options = $state<ComponentOptionsById>({});
  customCss = $state('');

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

  get options(): ComponentOptionsById {
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

    try {
      this.#apply(await this.#api.get());
    } catch (error) {
      this.error = errorMessage(error);
    }
  }

  async save(): Promise<boolean> {
    if (this.#api === undefined) {
      this.error = 'Open the desktop app to save changes.';
      return false;
    }

    const config = this.#current();
    this.error = null;
    try {
      const result = await this.#api.set(config);
      if (!result.ok) throw new Error(result.reason);
      this.#saved = JSON.stringify(config);
      return true;
    } catch (error) {
      this.error = errorMessage(error);
      return false;
    }
  }

  discard(): void {
    this.#apply(JSON.parse(this.#saved) as OverlayConfig);
  }

  resetComponent(id: string): void {
    this.#settings[id] = createDefaultComponentSettings(id);
  }

  get #api() {
    return globalThis.window?.dotaSpectatorTools?.settings;
  }

  #current(): OverlayConfig {
    return {
      enabled: $state.snapshot(this.#enabled),
      settings: $state.snapshot(this.#settings),
      options: $state.snapshot(this.#options),
      customCss: this.customCss
    };
  }

  #currentJson(): string {
    return JSON.stringify(this.#current());
  }

  #apply(config: OverlayConfig): void {
    const merged = mergeOverlayConfigDefaults(config);
    this.#enabled = merged.enabled;
    this.#settings = merged.settings;
    this.#options = merged.options;
    this.customCss = merged.customCss;
    this.#saved = JSON.stringify(merged);
  }
}

export const overlayConfig = new OverlayConfigStore();
