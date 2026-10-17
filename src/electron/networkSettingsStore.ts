import Store from 'electron-store';
import { randomBytes } from 'node:crypto';

import { logWarning } from '../shared/logger.js';
import {
  type ConfigurablePorts,
  DEFAULT_CONFIGURABLE_PORTS,
  type NetworkSettings,
  validatePorts
} from '../shared/networkConfig.js';

const PORTS_KEY = 'networkPorts';
const LAN_ACCESS_KEY = 'allowLanAccess';
const GSI_TOKEN_KEY = 'gsiToken';

export interface NetworkSettingsStore {
  get(): NetworkSettings;
  gsiToken(): string;
  setPorts(ports: ConfigurablePorts): void;
  setLanAccess(allow: boolean): void;
}

export function createNetworkSettingsStore(): NetworkSettingsStore {
  const store = new Store<{
    networkPorts: ConfigurablePorts;
    allowLanAccess: boolean;
    gsiToken?: string;
  }>({
    defaults: { networkPorts: { ...DEFAULT_CONFIGURABLE_PORTS }, allowLanAccess: false }
  });

  return {
    get() {
      // Merge over defaults so a config saved before a field existed still gets a value.
      const merged: ConfigurablePorts = { ...DEFAULT_CONFIGURABLE_PORTS, ...store.get(PORTS_KEY) };

      // A hand-edited file must not break startup; fall back to the defaults.
      const error = validatePorts(merged);
      if (error !== null) {
        logWarning(`Stored network ports are invalid (${error.message}); falling back to defaults`);
      }

      return {
        ports: error !== null ? { ...DEFAULT_CONFIGURABLE_PORTS } : merged,
        allowLanAccess: store.get(LAN_ACCESS_KEY) === true
      };
    },
    // Created on first use, so each install has its own.
    gsiToken() {
      const saved = store.get(GSI_TOKEN_KEY);
      if (typeof saved === 'string' && /^[0-9a-f]{32}$/.test(saved)) return saved;
      const token = randomBytes(16).toString('hex');
      store.set(GSI_TOKEN_KEY, token);
      return token;
    },
    setPorts(ports) {
      store.set(PORTS_KEY, ports);
    },
    setLanAccess(allow) {
      store.set(LAN_ACCESS_KEY, allow);
    }
  };
}
