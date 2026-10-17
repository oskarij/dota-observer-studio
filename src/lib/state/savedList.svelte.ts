import { errorMessage, type Result } from '../../shared/result.js';
import type { RosterSnapshot } from '../../shared/roster.js';

interface ListReader<T> {
  get(): Promise<RosterSnapshot<T>>;
  onChanged(handler: () => void): () => void;
}

export class SavedList<T> {
  items = $state<T[]>([]);
  error = $state<string | null>(null);
  warning = $state<string | null>(null);
  pending = $state(0);
  #loadVersion = 0;
  #unsubscribe: (() => void) | undefined;

  constructor(private readonly reader: () => ListReader<T> | undefined) {}

  async load(): Promise<void> {
    const version = ++this.#loadVersion;
    try {
      const api = this.reader();
      if (!api) throw new Error('Open the desktop app to edit saved data.');
      this.#unsubscribe ??= api.onChanged(() => {
        void this.load();
      });
      const snapshot = await api.get();
      if (version !== this.#loadVersion) return;
      this.items = snapshot.items;
      this.warning = snapshot.warning;
    } catch (error) {
      if (version === this.#loadVersion) this.error = errorMessage(error);
    }
  }

  dispose(): void {
    this.#unsubscribe?.();
    this.#unsubscribe = undefined;
    this.#loadVersion++;
  }

  async save(command: () => Promise<Result> | undefined): Promise<boolean> {
    this.pending++;
    this.error = null;
    try {
      const result = await command();
      if (!result) throw new Error('Open the desktop app to save changes.');
      if (!result.ok) throw new Error(result.reason);
      await this.load();
      return true;
    } catch (error) {
      this.error = errorMessage(error);
      return false;
    } finally {
      this.pending--;
    }
  }
}
