import Store from 'electron-store';
import { createValidatedSettings } from '../persistence/validatedSettings.js';
import { createDefaultOverlayConfig } from '../shared/componentSettings.js';
import { logWarning } from '../shared/logger.js';

export type SettingsStore = ReturnType<typeof createValidatedSettings>;

export function createSettingsStore(): SettingsStore {
  const store = new Store<{
    overlayConfig: unknown;
    invalidOverlayConfig?: unknown;
  }>({ defaults: { overlayConfig: createDefaultOverlayConfig() } });
  return createValidatedSettings({
    read: () => store.get('overlayConfig'),
    write: (config) => store.set('overlayConfig', config),
    recover: (invalid, error) => {
      store.set('invalidOverlayConfig', invalid);
      logWarning('Invalid saved overlay settings were archived; using defaults.', error);
    }
  });
}
