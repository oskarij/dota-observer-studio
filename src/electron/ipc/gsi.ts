import { ipcMain, type OpenDialogOptions } from 'electron';

import { GSI_INSTALL_CHANNEL } from '../../shared/ipcChannels.js';
import { logError } from '../../shared/logger.js';
import { resolveDotaCfgDir, writeGsiConfig } from '../gsiConfig.js';
import type { NetworkSettingsStore } from '../networkSettingsStore.js';

import { showOpenDialog } from './dialogs.js';

export interface GsiInstallResult {
  ok: boolean;
  // The written file path on success; a human-readable reason on failure/cancel.
  path?: string;
  reason?: string;
}

// Auto-detects the Dota cfg folder and writes the GSI config there; falls back to a folder picker
// when Dota can't be located. Uses the currently-stored GSI port (changes apply on relaunch).
export function registerGsiIpc(networkStore: NetworkSettingsStore): () => void {
  ipcMain.handle(GSI_INSTALL_CHANNEL, async (): Promise<GsiInstallResult> => {
    try {
      let cfgDir = await resolveDotaCfgDir();

      if (cfgDir === null) {
        const picked = await promptForCfgDir();
        if (picked === null) {
          return { ok: false, reason: 'Could not find Dota 2 and no folder was selected.' };
        }
        cfgDir = picked;
      }

      const gsiPort = networkStore.get().gsiListener;
      const path = await writeGsiConfig(cfgDir, gsiPort);
      return { ok: true, path };
    } catch (error) {
      logError('Failed to install the GSI config', error);
      return {
        ok: false,
        reason: 'Could not write the GSI config file. See the logs for details.'
      };
    }
  });

  return () => {
    ipcMain.removeHandler(GSI_INSTALL_CHANNEL);
  };
}

async function promptForCfgDir(): Promise<string | null> {
  const options: OpenDialogOptions = {
    title: 'Select your dota 2 beta/game/dota/cfg folder',
    properties: ['openDirectory'],
    buttonLabel: 'Install here',
    message: "Select …/dota 2 beta/game/dota/cfg."
  };

  const result = await showOpenDialog(options);
  return result.canceled ? null : (result.filePaths[0] ?? null);
}
