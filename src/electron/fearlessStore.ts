import Store from 'electron-store';
import {
  createFearlessRepository,
  EMPTY_FEARLESS_DATA,
  type FearlessData,
  type FearlessStore
} from '../persistence/fearlessRepository.js';

export function createFearlessStore(): FearlessStore {
  const store = new Store<FearlessData>({
    name: 'fearless-draft',
    defaults: structuredClone(EMPTY_FEARLESS_DATA)
  });
  return createFearlessRepository({
    get: (key) => store.get(key),
    set: (value) => store.set(value)
  });
}
