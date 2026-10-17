import {
  createDefaultOverlayConfig,
  mergeOverlayConfigDefaults,
  type OverlayConfig
} from '../shared/componentSettings.js';

export interface SettingsStorage {
  read(): unknown;
  write(config: OverlayConfig): void;
  recover(invalid: unknown, error: unknown): void;
}

export function createValidatedSettings(storage: SettingsStorage) {
  const saved = storage.read();
  let config = createDefaultOverlayConfig();
  try {
    config = mergeOverlayConfigDefaults(saved);
  } catch (error) {
    storage.recover(saved, error);
    config = createDefaultOverlayConfig();
  }
  storage.write(config);

  return {
    get: (): OverlayConfig => structuredClone(config),
    set(value: unknown): OverlayConfig {
      const next = mergeOverlayConfigDefaults(value);
      storage.write(next);
      config = next;
      return structuredClone(next);
    }
  };
}
