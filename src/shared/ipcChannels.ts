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

// Saves the GSI cfg (pointed at the LAN address) to a chosen file, for Dota on another PC.
export const GSI_EXPORT_CHANNEL = 'gsi:export';

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

// Fearless draft: the renderer reads the auto-captured watched games and the current series, and
// writes the series back on every edit (immediate persistence). Main re-broadcasts the resulting
// ban pool to the live overlay over SSE. fetch-match pulls an un-spectated game's heroes from
// OpenDota into the watched list; watched-games:changed notifies the renderer when capture/fetch
// adds a game so its list refreshes live.
export const WATCHED_GAMES_GET_CHANNEL = 'watched-games:get';
export const WATCHED_GAMES_CHANGED_CHANNEL = 'watched-games:changed';
export const FEARLESS_SERIES_GET_CHANNEL = 'fearless-series:get';
export const FEARLESS_SERIES_SET_CHANNEL = 'fearless-series:set';
export const FEARLESS_FETCH_MATCH_CHANNEL = 'fearless:fetch-match';

// App-lifecycle channels for the unsaved-changes guard on window close.
// Renderer reports its dirty state; main asks the renderer to save (then await its
// confirmation) before letting the window close.
export const APP_DIRTY_CHANGED_CHANNEL = 'app:dirty-changed';
export const APP_SAVE_AND_QUIT_CHANNEL = 'app:save-and-quit';
export const APP_QUIT_CONFIRMED_CHANNEL = 'app:quit-confirmed';
