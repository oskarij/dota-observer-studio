import type { Result } from '../../shared/result.js';
import { ipcMain, type OpenDialogOptions } from 'electron';
import { writeFile } from 'node:fs/promises';

import { GSI_EXPORT_CHANNEL, GSI_INSTALL_CHANNEL } from '../../shared/ipcChannels.js';
import { logError } from '../../shared/logger.js';
import { NETWORK_HOST } from '../../shared/networkConfig.js';
import {
  buildGsiConfig,
  CONFIG_FILE_NAME,
  resolveDotaCfgDir,
  writeGsiConfig
} from '../gsiConfig.js';
import { getLanIpv4 } from '../lanAddress.js';
import type { NetworkSettingsStore } from '../networkSettingsStore.js';

import { showOpenDialog, showSaveDialog } from './dialogs.js';

export type GsiInstallResult = Result<{ path: string }>;

// Install falls back to a folder picker when Dota is not found. Export writes the cfg with the LAN
// address, for Dota on another PC.
export function registerGsiIpc(networkStore: NetworkSettingsStore, lanActive: boolean): () => void {
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

      const gsiPort = networkStore.get().ports.gsiListener;
      const path = await writeGsiConfig(cfgDir, gsiPort, networkStore.gsiToken());
      return { ok: true, path };
    } catch (error) {
      logError('Failed to install the GSI config', error);
      return {
        ok: false,
        reason: 'Could not write the GSI config file. See the logs for details.'
      };
    }
  });

  ipcMain.handle(GSI_EXPORT_CHANNEL, async (): Promise<GsiInstallResult> => {
    try {
      const host = lanActive ? (getLanIpv4() ?? NETWORK_HOST) : NETWORK_HOST;
      const gsiPort = networkStore.get().ports.gsiListener;
      const result = await showSaveDialog({
        title: 'Export GSI config',
        defaultPath: CONFIG_FILE_NAME,
        filters: [{ name: 'Dota GSI config', extensions: ['cfg'] }]
      });

      if (result.canceled || result.filePath === undefined) {
        return { ok: false, reason: 'Export canceled.' };
      }

      await writeFile(
        result.filePath,
        buildGsiConfig(host, gsiPort, networkStore.gsiToken()),
        'utf8'
      );
      return { ok: true, path: result.filePath };
    } catch (error) {
      logError('Failed to export the GSI config', error);
      return { ok: false, reason: 'Could not write the GSI config file.' };
    }
  });

  return () => {
    ipcMain.removeHandler(GSI_INSTALL_CHANNEL);
    ipcMain.removeHandler(GSI_EXPORT_CHANNEL);
  };
}

async function promptForCfgDir(): Promise<string | null> {
  const options: OpenDialogOptions = {
    title: 'Select your dota 2 beta/game/dota/cfg folder',
    properties: ['openDirectory'],
    buttonLabel: 'Install here',
    message: 'Select …/dota 2 beta/game/dota/cfg.'
  };

  const result = await showOpenDialog(options);
  return result.canceled ? null : (result.filePaths[0] ?? null);
}
