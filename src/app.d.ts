import type { StudioApi } from './shared/studioApi.js';

declare global {
  namespace App {
    interface Locals {}
    interface PageData {}
    interface PageState {}
    interface Platform {}
  }

  interface Window {
    dotaSpectatorTools?: StudioApi;
  }
}

export {};
