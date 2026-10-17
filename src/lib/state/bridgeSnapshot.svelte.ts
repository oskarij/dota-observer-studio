import { logWarning } from '../../shared/logger.js';
import { errorMessage } from '../../shared/result.js';

interface SnapshotBridge<T> {
  get(): Promise<T>;
  onChanged(handler: () => void): () => void;
}

// One snapshot read over a preload bridge, reloaded whenever main reports a change.
export class BridgeSnapshot<T, Bridge extends SnapshotBridge<T>> {
  value = $state<T | null>(null);
  error = $state<string | null>(null);
  #loadVersion = 0;

  constructor(
    protected readonly bridge: () => Bridge | undefined,
    protected readonly unavailable: string
  ) {}

  async load(): Promise<void> {
    const api = this.bridge();
    if (api === undefined) {
      logWarning(this.unavailable);
      return;
    }

    const version = ++this.#loadVersion;
    try {
      const next = await api.get();
      if (version === this.#loadVersion) {
        this.value = next;
        this.error = null;
      }
    } catch (error) {
      this.error = errorMessage(error);
    }
  }

  listen(): () => void {
    return (
      this.bridge()?.onChanged(() => {
        void this.load();
      }) ?? (() => {})
    );
  }
}
