// A recorded game the operator can add to a series. playerNames align with heroIds and only label
// the game in the picker.
export interface WatchedGame {
  readonly matchId: string;
  readonly capturedAt: number; // epoch ms
  readonly heroIds: number[];
  readonly playerNames?: string[];
  // Spectated games only: who played, so the game can be linked to saved teams via known players.
  readonly accountIds?: string[];
}

// A game the operator has added to the current fearless series. `label` is a short human tag for the
// studio list; `heroIds` is copied from the watched game so the series stays self-contained.
export interface SeriesGame {
  readonly matchId: string;
  readonly heroIds: number[];
  readonly label: string;
}

export type FearlessCommand =
  | { kind: 'add'; game: SeriesGame }
  | { kind: 'remove'; matchId: string }
  | { kind: 'clear' }
  | { kind: 'automatic' };

export interface FearlessSeriesState {
  revision: number;
  games: SeriesGame[];
  manualOverride: boolean;
}

// Pushed to the overlay over SSE: the flat set of heroes banned for the upcoming draft.
export interface FearlessSeriesPayload {
  readonly bannedHeroIds: number[];
}

// Global ban pool: the union of every hero picked across the series, de-duped, in first-seen order.
export function bannedHeroIdsFromSeries(series: readonly SeriesGame[]): number[] {
  const seen = new Set<number>();

  for (const game of series) {
    for (const heroId of game.heroIds) {
      seen.add(heroId);
    }
  }

  return [...seen];
}
