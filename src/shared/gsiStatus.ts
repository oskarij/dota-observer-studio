// rejected: updates arrive without this install's auth token, i.e. from an old GSI config.
export type GsiStatus = 'live' | 'stale' | 'rejected';

export const GSI_STALE_TIMEOUT_MS = 5_000;
