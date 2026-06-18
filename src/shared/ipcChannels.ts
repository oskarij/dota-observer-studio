// IPC channel names for the settings bridge, used by the main-process handlers.
// The sandboxed preload (preload.cts) cannot import modules, so it inlines these
// same literals — keep the two in sync.
export const SETTINGS_GET_CHANNEL = 'settings:get';
export const SETTINGS_SET_CHANNEL = 'settings:set';

// Lists the font families installed on the user's machine for the component font picker.
export const FONTS_LIST_CHANNEL = 'fonts:list';

// Known-players list: the renderer reads it and writes the whole list back on every edit (immediate
// persistence, no Save bar), and main re-broadcasts to the live overlay over SSE.
export const KNOWN_PLAYERS_GET_CHANNEL = 'known-players:get';
export const KNOWN_PLAYERS_SET_CHANNEL = 'known-players:set';

// App-lifecycle channels for the unsaved-changes guard on window close.
// Renderer reports its dirty state; main asks the renderer to save (then await its
// confirmation) before letting the window close.
export const APP_DIRTY_CHANGED_CHANNEL = 'app:dirty-changed';
export const APP_SAVE_AND_QUIT_CHANNEL = 'app:save-and-quit';
export const APP_QUIT_CONFIRMED_CHANNEL = 'app:quit-confirmed';
