import { logError } from '../shared/logger.js';

export interface Observers<T> {
  add(listener: (value: T) => void): () => void;
  emit(value: T): void;
}

// Pub/sub primitive; emission isolates listener failures so one bad observer cannot stall the producer.
export function createObservers<T>(label: string): Observers<T> {
  const listeners = new Set<(value: T) => void>();

  return {
    add(listener) {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
    emit(value) {
      for (const listener of listeners) {
        try {
          listener(value);
        } catch (error) {
          logError(`${label} observer failed`, error);
        }
      }
    }
  };
}
