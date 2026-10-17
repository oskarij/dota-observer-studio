// Sample or live preview data. Module-level, so it survives navigation.
class PreviewSourceStore {
  #live = $state(false);

  get live(): boolean {
    return this.#live;
  }

  set live(value: boolean) {
    this.#live = value;
  }
}

export const previewSource = new PreviewSourceStore();
