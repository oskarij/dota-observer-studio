// Which game-state-specific overlay the Sample preview shows: the in-game readout (GAME_IN_PROGRESS)
// or the draft grid (HERO_SELECTION). Each overlay element self-gates on game_state, so switching
// this swaps which element is on screen. Module-level so the choice persists across navigation.
// In Live mode the real feed's game_state drives this instead, so the selector only affects Sample.
export type PreviewGameState = 'in-progress' | 'draft';

class PreviewGameStateStore {
  #value = $state<PreviewGameState>('in-progress');

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
