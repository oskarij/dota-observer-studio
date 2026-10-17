// SSE event name for pushing the resolved series state (team names/logos/scores) to live-overlay
// clients, mirroring OVERLAY_FEARLESS_EVENT. The studio reads/commands the series over the IPC
// bridge instead.
export const OVERLAY_SERIES_EVENT = 'overlay-series';
