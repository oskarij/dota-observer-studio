import {
  BrowserWindow,
  dialog,
  type OpenDialogOptions,
  type OpenDialogReturnValue,
  type SaveDialogOptions,
  type SaveDialogReturnValue
} from 'electron';

function focusedWindow(): BrowserWindow | undefined {
  return BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
}

export async function showSaveDialog(options: SaveDialogOptions): Promise<SaveDialogReturnValue> {
  const window = focusedWindow();
  return window === undefined
    ? dialog.showSaveDialog(options)
    : dialog.showSaveDialog(window, options);
}

export async function showOpenDialog(options: OpenDialogOptions): Promise<OpenDialogReturnValue> {
  const window = focusedWindow();
  return window === undefined
    ? dialog.showOpenDialog(options)
    : dialog.showOpenDialog(window, options);
}
