// Checkerboard or in-game screenshot behind the preview. Module-level, so it survives navigation.
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
