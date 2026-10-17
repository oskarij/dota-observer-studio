import { ipcMain, type OpenDialogOptions } from 'electron';
import { copyFile, mkdir, readdir, unlink } from 'node:fs/promises';
import { extname, join } from 'node:path';

import type { RosterService } from '../../runtime/rosterService.js';
import { SAFE_TEAM_ID } from '../../shared/roster.js';
import {
  TEAMS_GET_CHANNEL,
  TEAMS_PICK_LOGO_CHANNEL,
  TEAMS_ADD_CHANNEL,
  TEAMS_UPDATE_CHANNEL,
  TEAMS_REMOVE_CHANNEL
} from '../../shared/ipcChannels.js';
import { logError } from '../../shared/logger.js';

import { showOpenDialog } from './dialogs.js';

type TeamsPickLogoResult = ReturnType<RosterService['updateTeam']>;

const LOGO_DIR = 'team-logos';
const LOGO_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'svg'];

export function registerTeamsIpc(roster: RosterService, mediaRoot: string): () => void {
  ipcMain.handle(TEAMS_GET_CHANNEL, () => roster.getTeams());
  ipcMain.handle(TEAMS_ADD_CHANNEL, (_event, team: unknown) => roster.addTeam(team));
  ipcMain.handle(TEAMS_UPDATE_CHANNEL, (_event, id: unknown, patch: unknown) =>
    roster.updateTeam(id, patch)
  );
  ipcMain.handle(TEAMS_REMOVE_CHANNEL, (_event, id: unknown) => roster.removeTeam(id));

  ipcMain.handle(
    TEAMS_PICK_LOGO_CHANNEL,
    async (_event, teamId: unknown): Promise<TeamsPickLogoResult> => {
      if (typeof teamId !== 'string' || !SAFE_TEAM_ID.test(teamId)) {
        return { ok: false, reason: 'Invalid team id.' };
      }

      try {
        const openOptions: OpenDialogOptions = {
          title: 'Choose team logo',
          properties: ['openFile'],
          filters: [{ name: 'Images', extensions: LOGO_EXTENSIONS }]
        };
        const result = await showOpenDialog(openOptions);

        const sourcePath = result.canceled ? undefined : result.filePaths[0];
        if (sourcePath === undefined) {
          return { ok: true };
        }

        const extension = extname(sourcePath).toLowerCase();
        if (!LOGO_EXTENSIONS.includes(extension.slice(1))) {
          return { ok: false, reason: 'Unsupported image type.' };
        }

        const logoDir = join(mediaRoot, LOGO_DIR);
        await mkdir(logoDir, { recursive: true });

        const fileName = `${teamId}-${Date.now()}${extension}`;
        await copyFile(sourcePath, join(logoDir, fileName));
        const saved = roster.updateTeam(teamId, { logoPath: `/media/${LOGO_DIR}/${fileName}` });
        if (saved.ok) await removeOldLogos(logoDir, teamId, fileName);
        else await unlink(join(logoDir, fileName));
        return saved;
      } catch (error) {
        logError('Failed to set team logo', error);
        return { ok: false, reason: 'Could not copy the logo file.' };
      }
    }
  );

  return () => {
    ipcMain.removeHandler(TEAMS_GET_CHANNEL);
    ipcMain.removeHandler(TEAMS_ADD_CHANNEL);
    ipcMain.removeHandler(TEAMS_UPDATE_CHANNEL);
    ipcMain.removeHandler(TEAMS_REMOVE_CHANNEL);
    ipcMain.removeHandler(TEAMS_PICK_LOGO_CHANNEL);
  };
}

async function removeOldLogos(logoDir: string, teamId: string, keep: string): Promise<void> {
  const ownLogo = new RegExp(`^${teamId}-\\d+\\.`);

  try {
    const entries = await readdir(logoDir);
    await Promise.all(
      entries
        .filter((entry) => entry !== keep && ownLogo.test(entry))
        .map((entry) => unlink(join(logoDir, entry)))
    );
  } catch {
    // Ignore: the new logo is already in place.
  }
}
