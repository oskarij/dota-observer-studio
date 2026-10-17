import { GSI_STALE_TIMEOUT_MS, type GsiStatus } from '../shared/gsiStatus.js';
import { createObservers } from './observers.js';

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
  const statusObservers = createObservers<GsiStatus>('GSI liveness');

  let status: GsiStatus = 'stale';
  let staleTimer: NodeJS.Timeout | null = null;

  function setStatus(nextStatus: GsiStatus): void {
    if (nextStatus === status) {
      return;
    }

    status = nextStatus;
    statusObservers.emit(status);
  }

  function markAlive(): void {
    setStatus('live');
    armStaleTimer();
  }

  function armStaleTimer(): void {
    if (staleTimer !== null) {
      staleTimer.refresh();
      return;
    }
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

  return {
    getStatus() {
      return status;
    },
    markAlive,
    onStatusChange: statusObservers.add,
    stop() {
      clearStaleTimer();
      setStatus('stale');
    }
  };
}
