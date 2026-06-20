import { ipcMain } from 'electron';

import { NETWORK_GET_CHANNEL, NETWORK_SET_CHANNEL } from '../../shared/ipcChannels.js';
import {
  buildNetworkInfo,
  type ConfigurablePorts,
  NETWORK_HOST,
  type NetworkInfo,
  type NetworkSettings,
  type PortConflicts,
  validatePorts
} from '../../shared/networkConfig.js';
import { getLanIpv4 } from '../lanAddress.js';
import type { NetworkSettingsStore } from '../networkSettingsStore.js';

export interface NetworkSetResult {
  ok: boolean;
  reason?: string;
}

// Rebinds the running servers to the new ports in-process. Implemented in main.ts (it owns the
// server instances); resolves ok:false if a port can't be bound, leaving the old servers running.
export type ApplyPorts = (ports: ConfigurablePorts) => Promise<NetworkSetResult>;

// Ports apply live (SET rebinds the servers); the LAN toggle is persisted and applies on the next
// launch, so lanActive (what's bound now) drives the advertised host and the restart-pending flag.
// SET re-validates ports rather than trusting the renderer.
export function registerNetworkIpc(
  store: NetworkSettingsStore,
  applyPorts: ApplyPorts,
  lanActive: boolean,
  portConflicts: PortConflicts
): () => void {
  function info(): NetworkInfo {
    const advertisedHost = lanActive ? (getLanIpv4() ?? NETWORK_HOST) : NETWORK_HOST;
    return buildNetworkInfo(store.get(), advertisedHost, lanActive, portConflicts);
  }

  ipcMain.handle(NETWORK_GET_CHANNEL, info);

  ipcMain.handle(
    NETWORK_SET_CHANNEL,
    async (_event, settings: NetworkSettings): Promise<NetworkSetResult> => {
      const error = validatePorts(settings.ports);
      if (error !== null) {
        return { ok: false, reason: error.message };
      }

      const result = await applyPorts(settings.ports);
      if (result.ok) {
        store.setPorts(settings.ports);
        store.setLanAccess(settings.allowLanAccess);
      }
      return result;
    }
  );

  return () => {
    ipcMain.removeHandler(NETWORK_GET_CHANNEL);
    ipcMain.removeHandler(NETWORK_SET_CHANNEL);
  };
}
