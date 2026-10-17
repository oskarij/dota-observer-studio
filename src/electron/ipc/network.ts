import type { Result } from '../../shared/result.js';
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

export type NetworkSetResult = Result;

// Rebinds the running servers. Resolves ok:false and keeps the old servers when a port is busy.
export type ApplyPorts = (ports: ConfigurablePorts) => Promise<NetworkSetResult>;

// Ports apply live. The LAN toggle applies on the next launch, so lanActive (what is bound now)
// sets the advertised host and the restart flag.
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
