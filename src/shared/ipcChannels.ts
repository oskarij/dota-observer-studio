// IPC channel names for the settings bridge, used by the main-process handlers.
// The sandboxed preload (preload.cts) cannot import modules, so it inlines these
// same literals — keep the two in sync.
export const SETTINGS_GET_CHANNEL = 'settings:get';
export const SETTINGS_SET_CHANNEL = 'settings:set';
