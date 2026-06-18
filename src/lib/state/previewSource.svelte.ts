// Preview data source: static sample vs. live game feed. Module-level so the choice persists
// across navigation — page-local $state resets every time the Overlay page remounts.
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
