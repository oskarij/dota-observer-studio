import Store from 'electron-store';

import { logWarning } from '../shared/logger.js';
import {
  type ConfigurablePorts,
  DEFAULT_CONFIGURABLE_PORTS,
  validatePorts
} from '../shared/networkConfig.js';

const STORE_KEY = 'networkPorts';

export interface NetworkSettingsStore {
  get(): ConfigurablePorts;
  set(ports: ConfigurablePorts): void;
}

export function createNetworkSettingsStore(): NetworkSettingsStore {
  const store = new Store<{ networkPorts: ConfigurablePorts }>({
    defaults: { networkPorts: { ...DEFAULT_CONFIGURABLE_PORTS } }
  });

  return {
    get() {
      // Merge over defaults so a config saved before a field existed still gets a value.
      const merged: ConfigurablePorts = { ...DEFAULT_CONFIGURABLE_PORTS, ...store.get(STORE_KEY) };

      // Defensive: a hand-edited file (or a future reserved-port change) must never brick startup
      // by binding to a reserved/duplicate/out-of-range port. Fall back to the defaults instead.
      const error = validatePorts(merged);
      if (error !== null) {
        logWarning(`Stored network ports are invalid (${error.message}); falling back to defaults`);
        return { ...DEFAULT_CONFIGURABLE_PORTS };
      }

      return merged;
    },
    set(ports) {
      store.set(STORE_KEY, ports);
    }
  };
}
