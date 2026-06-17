import Store from 'electron-store';

import type { ComponentOptions } from '../shared/componentOptions.js';
import { createDefaultOverlayConfig, type OverlayConfig } from '../shared/componentSettings.js';

const STORE_KEY = 'overlayConfig';

export interface SettingsStore {
  get(): OverlayConfig;
  set(config: OverlayConfig): void;
}

export function createSettingsStore(): SettingsStore {
  const store = new Store<{ overlayConfig: OverlayConfig }>({
    defaults: { overlayConfig: createDefaultOverlayConfig() }
  });

  return {
    get() {
      // Merge over defaults so components added after a config was saved still get values.
      const defaults = createDefaultOverlayConfig();
      const stored = store.get(STORE_KEY);

      // Field-level merge per component so options saved before a new field existed still get
      // the default for that field (stored.options is absent in configs from before options).
      const options: Record<string, ComponentOptions> = { ...defaults.options };
      for (const [id, value] of Object.entries(stored.options ?? {})) {
        options[id] = { ...defaults.options[id], ...value };
      }

      return {
        enabled: { ...defaults.enabled, ...stored.enabled },
        settings: { ...defaults.settings, ...stored.settings },
        options
      };
    },
    set(config) {
      store.set(STORE_KEY, config);
    }
  };
}
