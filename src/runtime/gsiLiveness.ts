import { GSI_STALE_TIMEOUT_MS, type GsiStatus } from '../shared/gsiStatus.js';

export interface GsiLivenessConfig {
  readonly timeoutMs?: number;
}

export interface GsiLiveness {
  getStatus(): GsiStatus;
  markAlive(): void;
  onStatusChange(listener: (status: GsiStatus) => void): () => void;
  stop(): void;
}

export function createGsiLiveness(config: GsiLivenessConfig = {}): GsiLiveness {
  const timeoutMs = config.timeoutMs ?? GSI_STALE_TIMEOUT_MS;
  const statusListeners = new Set<(status: GsiStatus) => void>();

  let status: GsiStatus = 'stale';
  let staleTimer: NodeJS.Timeout | null = null;

  function setStatus(nextStatus: GsiStatus): void {
    if (nextStatus === status) {
      return;
    }

    status = nextStatus;
    emitStatus();
  }

  function markAlive(): void {
    setStatus('live');
    armStaleTimer();
  }

  function armStaleTimer(): void {
    clearStaleTimer();
    staleTimer = setTimeout(() => {
      staleTimer = null;
      setStatus('stale');
    }, timeoutMs);
    // Liveness tracking must not keep the process alive on its own.
    staleTimer.unref();
  }

  function clearStaleTimer(): void {
    if (staleTimer === null) {
      return;
    }

    clearTimeout(staleTimer);
    staleTimer = null;
  }

  function emitStatus(): void {
    for (const listener of statusListeners) {
      try {
        listener(status);
      } catch {
        // Observers must not interrupt liveness tracking.
      }
    }
  }

  return {
    getStatus() {
      return status;
    },
    markAlive,
    onStatusChange(listener) {
      statusListeners.add(listener);

      return () => {
        statusListeners.delete(listener);
      };
    },
    stop() {
      clearStaleTimer();
      setStatus('stale');
    }
  };
}
