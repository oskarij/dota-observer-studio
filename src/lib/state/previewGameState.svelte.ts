// Which of the two overlay scenes the Overlay page edits: the in-game scene (GAME_IN_PROGRESS sample)
// or the draft scene (HERO_SELECTION sample). Each scene is its own OBS Browser source, and the
// preview mounts only the selected scene's elements — exactly what that source renders. Module-level
// so the choice persists across navigation. In Live mode the real feed's game_state decides what the
// mounted elements show, so the selector only swaps the sample data there.
export type PreviewGameState = 'in-progress' | 'draft';

class PreviewGameStateStore {
  // Draft by default: it is the first phase tab and the first phase of a match.
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
