// The scene the Overlay page edits. The preview mounts only that scene's elements, like its OBS
// Browser source. In Live mode the feed's game_state decides what they show, so this only swaps the
// sample data. Module-level, so it survives navigation.
export type PreviewGameState = 'in-progress' | 'draft';

class PreviewGameStateStore {
  #value = $state<PreviewGameState>('draft');

  get value(): PreviewGameState {
    return this.#value;
  }

  set value(next: PreviewGameState) {
    this.#value = next;
  }

  get draft(): boolean {
    return this.#value === 'draft';
  }
}

export const previewGameState = new PreviewGameStateStore();
