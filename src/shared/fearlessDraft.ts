// Shared fearless-draft types + helpers, framework-agnostic so the main process (persistence + IPC),
// the renderer (studio UI), and the overlay all use one shape.

// How a watched game's heroes were obtained: live from a spectated game's GSI feed, fetched from
// OpenDota for a game the operator didn't spectate, or hand-picked (when OpenDota can't parse it).
export type WatchedGameSource = 'spectated' | 'opendota' | 'manual';

// A game whose 10 picked heroes have been recorded, available for the operator to add to a series.
// The optional metadata is best-effort for labelling the match in the picker: team names come from
// OpenDota pro matches; player names (aligned with heroIds) come from either source when available.
export interface WatchedGame {
  readonly matchId: string;
  readonly capturedAt: number; // epoch ms
  readonly heroIds: number[];
  readonly source: WatchedGameSource;
  readonly radiantTeam?: string;
  readonly direTeam?: string;
  readonly playerNames?: string[];
}

// A game the operator has added to the current fearless series. `label` is a short human tag for the
// studio list; `heroIds` is copied from the watched game so the series stays self-contained.
export interface SeriesGame {
  readonly matchId: string;
  readonly heroIds: number[];
  readonly label: string;
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
