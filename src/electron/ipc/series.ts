import { ipcMain } from 'electron';
import type { SeriesStateService } from '../../runtime/seriesStateService.js';
import { errorMessage, type Result } from '../../shared/result.js';
import {
  SERIES_ADJUST_SCORE_CHANNEL,
  SERIES_GET_CHANNEL,
  SERIES_RESET_CHANNEL,
  SERIES_SET_TEAM_CHANNEL,
  SERIES_SWAP_SIDES_CHANNEL,
  SERIES_USE_AUTOMATIC_SCORE_CHANNEL
} from '../../shared/ipcChannels.js';
import type { Side } from '../../shared/seriesState.js';

function isSide(value: unknown): value is Side {
  return value === 'radiant' || value === 'dire';
}
function run(command: () => void): Result {
  try {
    command();
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: errorMessage(error) };
  }
}

export function registerSeriesIpc(service: SeriesStateService): () => void {
  ipcMain.handle(SERIES_GET_CHANNEL, () => service.getSnapshot());
  ipcMain.handle(SERIES_SET_TEAM_CHANNEL, (_event, side: unknown, teamId: unknown): Result => {
    if (!isSide(side) || (teamId !== null && typeof teamId !== 'string'))
      return { ok: false, reason: 'Invalid team choice.' };
    return run(() => service.setManualTeam(side, teamId));
  });
  ipcMain.handle(SERIES_SWAP_SIDES_CHANNEL, (): Result => run(() => service.swapManualSides()));
  ipcMain.handle(SERIES_ADJUST_SCORE_CHANNEL, (_event, side: unknown, delta: unknown): Result => {
    if (!isSide(side) || (delta !== 1 && delta !== -1))
      return { ok: false, reason: 'Invalid score adjustment.' };
    return run(() => service.adjustScore(side, delta));
  });
  ipcMain.handle(SERIES_RESET_CHANNEL, (): Result => run(() => service.resetScores()));
  ipcMain.handle(
    SERIES_USE_AUTOMATIC_SCORE_CHANNEL,
    (): Result => run(() => service.useAutomaticScore())
  );
  return () => {
    for (const channel of [
      SERIES_GET_CHANNEL,
      SERIES_SET_TEAM_CHANNEL,
      SERIES_SWAP_SIDES_CHANNEL,
      SERIES_ADJUST_SCORE_CHANNEL,
      SERIES_RESET_CHANNEL,
      SERIES_USE_AUTOMATIC_SCORE_CHANNEL
    ])
      ipcMain.removeHandler(channel);
  };
}
