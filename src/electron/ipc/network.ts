import { ipcMain } from 'electron';

import { NETWORK_GET_CHANNEL, NETWORK_SET_CHANNEL } from '../../shared/ipcChannels.js';
import {
  buildNetworkInfo,
  type ConfigurablePorts,
  type NetworkInfo,
  validatePorts
} from '../../shared/networkConfig.js';
import type { NetworkSettingsStore } from '../networkSettingsStore.js';

export interface NetworkSetResult {
  ok: boolean;
  reason?: string;
}

// Rebinds the running servers to the new ports in-process. Implemented in main.ts (it owns the
// server instances); resolves ok:false if a port can't be bound, leaving the old servers running.
export type ApplyPorts = (ports: ConfigurablePorts) => Promise<NetworkSetResult>;

// Ports are applied live: SET re-validates (not trusting the renderer), rebinds the servers, and
// only persists once the rebind succeeds so the stored ports always match what's actually bound.
export function registerNetworkIpc(
  store: NetworkSettingsStore,
  applyPorts: ApplyPorts
): () => void {
  ipcMain.handle(NETWORK_GET_CHANNEL, (): NetworkInfo => buildNetworkInfo(store.get()));

  ipcMain.handle(
    NETWORK_SET_CHANNEL,
    async (_event, ports: ConfigurablePorts): Promise<NetworkSetResult> => {
      const error = validatePorts(ports);
      if (error !== null) {
        return { ok: false, reason: error.message };
      }

      const result = await applyPorts(ports);
      if (result.ok) {
        store.set(ports);
      }
      return result;
    }
  );

  return () => {
    ipcMain.removeHandler(NETWORK_GET_CHANNEL);
    ipcMain.removeHandler(NETWORK_SET_CHANNEL);
  };
}
