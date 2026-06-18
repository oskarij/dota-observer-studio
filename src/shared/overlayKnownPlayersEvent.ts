// SSE event name for pushing the known-players list to live-overlay clients, mirroring
// OVERLAY_SETTINGS_EVENT. The renderer UI/preview read the same list over the IPC bridge instead.
export const OVERLAY_KNOWN_PLAYERS_EVENT = 'overlay-known-players';
