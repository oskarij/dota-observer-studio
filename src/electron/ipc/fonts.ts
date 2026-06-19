import { ipcMain } from 'electron';
import { getFonts } from 'font-list';

import { logWarning } from '../../shared/logger.js';
import { FONTS_LIST_CHANNEL } from '../../shared/ipcChannels.js';

// Exposes the machine's installed font families to the renderer's font picker. The
// overlay renders in the same Chromium, so a family name is enough; no file loading.
export function registerFontsIpc(): () => void {
  ipcMain.handle(FONTS_LIST_CHANNEL, async (): Promise<string[]> => {
    try {
      // disableQuoting strips the wrapping quotes font-list adds to names with spaces.
      const fonts = await getFonts({ disableQuoting: true });
      return [...new Set(fonts)].sort((a, b) => a.localeCompare(b));
    } catch (error) {
      logWarning(`Failed to enumerate system fonts: ${String(error)}`);
      return [];
    }
  });

  return () => {
    ipcMain.removeHandler(FONTS_LIST_CHANNEL);
  };
}
