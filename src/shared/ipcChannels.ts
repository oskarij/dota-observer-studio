// IPC channel names for the settings bridge, used by the main-process handlers.
// The sandboxed preload (preload.cts) cannot import modules, so it inlines these
// same literals. Keep the two in sync.
export const SETTINGS_GET_CHANNEL = 'settings:get';
export const SETTINGS_SET_CHANNEL = 'settings:set';

// Overlay config backup: main opens a file dialog and reads/writes the config JSON itself.
export const SETTINGS_EXPORT_CHANNEL = 'settings:export';
export const SETTINGS_IMPORT_CHANNEL = 'settings:import';

// Network ports the user can override (overlay host + GSI listener). Applied live: the servers
// rebind in-process on set. The event-stream port stays fixed and unexposed.
export const NETWORK_GET_CHANNEL = 'network:get';
export const NETWORK_SET_CHANNEL = 'network:set';

// Writes the gamestate_integration cfg into the Dota 2 cfg folder, pointed at the GSI port.
export const GSI_INSTALL_CHANNEL = 'gsi:install';

// Clears the persisted OpenDota rank cache so the in-game medal refetches.
export const PLAYER_RANKS_CLEAR_CHANNEL = 'player-ranks:clear';

// Font families installed on the user's machine, for the component font picker.
export const FONTS_LIST_CHANNEL = 'fonts:list';

// Known-players list: the renderer reads it and writes the whole list back on every edit (immediate
// persistence, no Save bar), and main re-broadcasts to the live overlay over SSE.
export const KNOWN_PLAYERS_GET_CHANNEL = 'known-players:get';
export const KNOWN_PLAYERS_SET_CHANNEL = 'known-players:set';

// CSV backup of the known-players list. Main handles the file dialog + raw file I/O; the renderer
// owns serialize/parse + validation (shared knownPlayersCsv util) so it can reuse the editor rules.
export const KNOWN_PLAYERS_EXPORT_CSV_CHANNEL = 'known-players:export-csv';
export const KNOWN_PLAYERS_IMPORT_CSV_CHANNEL = 'known-players:import-csv';

// App-lifecycle channels for the unsaved-changes guard on window close.
// Renderer reports its dirty state; main asks the renderer to save (then await its
// confirmation) before letting the window close.
export const APP_DIRTY_CHANGED_CHANNEL = 'app:dirty-changed';
export const APP_SAVE_AND_QUIT_CHANNEL = 'app:save-and-quit';
export const APP_QUIT_CONFIRMED_CHANNEL = 'app:quit-confirmed';
