// Sandboxed preload channel literals must match these names.

export const SETTINGS_GET_CHANNEL = 'settings:get';
export const SETTINGS_SET_CHANNEL = 'settings:set';

export const SETTINGS_EXPORT_CHANNEL = 'settings:export';
export const SETTINGS_IMPORT_CHANNEL = 'settings:import';
export const SETTINGS_OPEN_MEDIA_FOLDER_CHANNEL = 'settings:open-media-folder';
export const SETTINGS_OPEN_LOGS_FOLDER_CHANNEL = 'settings:open-logs-folder';

export const NETWORK_GET_CHANNEL = 'network:get';
export const NETWORK_SET_CHANNEL = 'network:set';

export const GSI_INSTALL_CHANNEL = 'gsi:install';

export const GSI_EXPORT_CHANNEL = 'gsi:export';

export const PLAYER_RANKS_CLEAR_CHANNEL = 'player-ranks:clear';

export const FONTS_LIST_CHANNEL = 'fonts:list';

export const KNOWN_PLAYERS_GET_CHANNEL = 'known-players:get';
export const KNOWN_PLAYERS_SET_CHANNEL = 'known-players:set';
export const KNOWN_PLAYERS_ADD_CHANNEL = 'known-players:add';
export const KNOWN_PLAYERS_UPDATE_CHANNEL = 'known-players:update';
export const KNOWN_PLAYERS_REMOVE_CHANNEL = 'known-players:remove';
export const KNOWN_PLAYERS_CHANGED_CHANNEL = 'known-players:changed';

export const KNOWN_PLAYERS_EXPORT_CSV_CHANNEL = 'known-players:export-csv';
export const KNOWN_PLAYERS_IMPORT_CSV_CHANNEL = 'known-players:import-csv';

export const TEAMS_GET_CHANNEL = 'teams:get';
export const TEAMS_ADD_CHANNEL = 'teams:add';
export const TEAMS_UPDATE_CHANNEL = 'teams:update';
export const TEAMS_REMOVE_CHANNEL = 'teams:remove';
export const TEAMS_CHANGED_CHANNEL = 'teams:changed';
export const TEAMS_PICK_LOGO_CHANNEL = 'teams:pick-logo';

export const WATCHED_GAMES_GET_CHANNEL = 'watched-games:get';
export const WATCHED_GAMES_CHANGED_CHANNEL = 'watched-games:changed';
export const FEARLESS_SERIES_GET_CHANNEL = 'fearless-series:get';
export const FEARLESS_SERIES_SET_CHANNEL = 'fearless-series:set';

export const FEARLESS_SERIES_CHANGED_CHANNEL = 'fearless-series:changed';
export const FEARLESS_FETCH_MATCH_CHANNEL = 'fearless:fetch-match';

export const SERIES_GET_CHANNEL = 'series:get';
export const SERIES_SET_TEAM_CHANNEL = 'series:set-team';
export const SERIES_SWAP_SIDES_CHANNEL = 'series:swap-sides';
export const SERIES_ADJUST_SCORE_CHANNEL = 'series:adjust-score';
export const SERIES_USE_AUTOMATIC_SCORE_CHANNEL = 'series:use-automatic-score';
export const SERIES_RESET_CHANNEL = 'series:reset-scores';
export const SERIES_CHANGED_CHANNEL = 'series:changed';

export const TOURNAMENT_GET_CHANNEL = 'tournament:get';
export const TOURNAMENT_REFRESH_CHANNEL = 'tournament:refresh';
export const TOURNAMENT_SET_API_KEY_CHANNEL = 'tournament:set-api-key';
export const TOURNAMENT_CHANGED_CHANNEL = 'tournament:changed';

export const APP_DIRTY_CHANGED_CHANNEL = 'app:dirty-changed';
export const APP_SAVE_AND_QUIT_CHANNEL = 'app:save-and-quit';
export const APP_QUIT_CONFIRMED_CHANNEL = 'app:quit-confirmed';
