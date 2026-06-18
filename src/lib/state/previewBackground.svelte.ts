// Preview backdrop: transparency checkerboard vs. an in-game screenshot, so the overlay can be
// previewed against a realistic Dota frame. Module-level so the choice persists across navigation —
// page-local $state resets every time the Overlay page remounts.
class PreviewBackgroundStore {
  #inGame = $state(false);

  get inGame(): boolean {
    return this.#inGame;
  }

  set inGame(value: boolean) {
    this.#inGame = value;
  }
}

export const previewBackground = new PreviewBackgroundStore();
