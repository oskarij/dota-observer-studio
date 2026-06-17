import Store from 'electron-store';

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

      return {
        enabled: { ...defaults.enabled, ...stored.enabled },
        settings: { ...defaults.settings, ...stored.settings }
      };
    },
    set(config) {
      store.set(STORE_KEY, config);
    }
  };
}
