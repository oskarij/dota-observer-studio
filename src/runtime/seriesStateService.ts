import type { DotaGsiLeagueTeam } from '../shared/dotaGsiPayload.js';
import type { KnownPlayer } from '../shared/knownPlayer.js';
import { positiveId, type MatchContext } from '../shared/matchContext.js';
import {
  parsePersistedSeriesState,
  resolveSeries,
  seriesKeyOf,
  SIDES,
  type PersistedSeriesState,
  type SeriesSnapshot,
  type SeriesStatePayload,
  type Side
} from '../shared/seriesState.js';
import type { Team } from '../shared/team.js';
import { dominantTeamId, teamIdByAccount } from '../shared/teamMatching.js';

const COUNTED_MATCH_IDS_CAP = 20;

export interface SeriesStateServiceConfig {
  store: { get(): unknown; set(state: PersistedSeriesState): void };
  teams(): Team[];
  upsertTeam(team: Team): void;
  knownPlayers(): KnownPlayer[];
  sink: { setSeriesState(payload: SeriesStatePayload): void };
  notifyChanged?: () => void;
  onNewSeries?: (key: string | null) => void;
  newTeamId?: () => string;
}

export type SeriesStateService = ReturnType<typeof createSeriesStateService>;

export function createSeriesStateService(config: SeriesStateServiceConfig) {
  const newTeamId = config.newTeamId ?? (() => globalThis.crypto.randomUUID());
  let state = parsePersistedSeriesState(config.store.get());
  let history: Record<number, number> | null = null;
  let lastInputKey: string | null = null;
  let lastPayloadKey: string | null = null;
  let sidesCheckedFor: string | null = null;

  function view() {
    return resolveSeries(state, config.teams(), history);
  }

  function publish(): void {
    const { payload } = view();
    const key = JSON.stringify(payload);
    if (key !== lastPayloadKey) {
      config.sink.setSeriesState(payload);
      lastPayloadKey = key;
    }
    config.notifyChanged?.();
  }

  // The one place a new series starts: its key changed, so the old scores no longer apply.
  function rekey(next: PersistedSeriesState): void {
    const key = seriesKeyOf(next);
    if (key === null || key === next.key) return;
    next.key = key;
    next.counted = {};
    next.countedMatchIds = [];
    next.override = null;
  }

  // Saved before it is applied, so a failed write leaves the state and the overlay as they were.
  function update(change: (next: PersistedSeriesState) => void): void {
    const next = structuredClone(state);
    change(next);
    rekey(next);
    const newSeries = next.key !== state.key;
    if (JSON.stringify(next) !== JSON.stringify(state)) config.store.set(next);
    state = next;
    if (newSeries) {
      // The old series' Valve history no longer applies; the new one arrives from its lookup.
      history = null;
      config.onNewSeries?.(next.key);
    }
    publish();
  }

  // Valve-identified ticket teams are saved on first sight, so a logo can be attached to them.
  function saveTicketTeams(ticketTeams: (DotaGsiLeagueTeam | undefined)[]): void {
    for (const team of ticketTeams) {
      const valveTeamId = positiveId(team?.team_id);
      if (valveTeamId === null || config.teams().some((t) => t.externalTeamId === valveTeamId))
        continue;
      config.upsertTeam({
        id: newTeamId(),
        name: team?.name?.trim() || team?.team_tag?.trim() || `Team ${String(valveTeamId)}`,
        tag: team?.team_tag?.trim() ?? '',
        logoPath: null,
        externalTeamId: valveTeamId
      });
    }
  }

  // Without a ticket, linked players place the teams once per match; a later manual swap sticks.
  function placeTeamsFromPlayers(next: PersistedSeriesState, context: MatchContext): void {
    const byAccount = teamIdByAccount(config.knownPlayers());
    const radiant = dominantTeamId(context.accounts.radiant, byAccount);
    const dire = dominantTeamId(context.accounts.dire, byAccount);
    const { manual } = next;
    if (radiant !== null && dire !== null && radiant !== dire) next.manual = { radiant, dire };
    else if (
      (radiant !== null && radiant === manual.dire) ||
      (dire !== null && dire === manual.radiant)
    )
      next.manual = { radiant: manual.dire, dire: manual.radiant };
  }

  // Only ticketed games count: without a ticket the operator keeps the score.
  function countWinner(next: PersistedSeriesState, context: MatchContext): void {
    const { matchId, winner } = context;
    if (!context.postGame || winner === null || matchId === null || next.ticket === null) return;
    if (next.countedMatchIds.includes(matchId)) return;
    const team = resolveSeries(next, config.teams(), history).snapshot.sides[winner];
    if (team === null) return;
    next.counted[team.key] = (next.counted[team.key] ?? 0) + 1;
    next.countedMatchIds = [...next.countedMatchIds, matchId].slice(-COUNTED_MATCH_IDS_CAP);
  }

  function handleContext(context: MatchContext): void {
    // A match is live once it reaches the draft; its ticket (or lack of one) then replaces the last.
    const live =
      context.matchId !== null &&
      (context.preGame ||
        context.postGame ||
        context.gameState === 'DOTA_GAMERULES_STATE_GAME_IN_PROGRESS');
    const inputKey = JSON.stringify([
      context.matchId,
      context.gameState,
      context.league,
      context.winner,
      live && context.league === null ? context.accounts : null
    ]);
    if (inputKey === lastInputKey) return;
    const placeSides =
      live &&
      context.league === null &&
      sidesCheckedFor !== context.matchId &&
      context.accounts.radiant.length + context.accounts.dire.length > 0;
    if (live) saveTicketTeams([context.league?.radiant, context.league?.dire]);
    update((next) => {
      if (live) next.ticket = context.league;
      if (placeSides) placeTeamsFromPlayers(next, context);
      rekey(next);
      countWinner(next, context);
    });
    if (placeSides) sidesCheckedFor = context.matchId;
    lastInputKey = inputKey;
  }

  function sideTeam(side: Side) {
    const team = view().snapshot.sides[side];
    if (team === null) throw new Error('There is no team on that side.');
    return team;
  }

  return {
    handleContext,
    getSnapshot(): SeriesSnapshot {
      return view().snapshot;
    },
    key: (): string | null => state.key,
    setHistoryWins(wins: Record<number, number> | null): void {
      history = wins;
      publish();
    },
    setManualTeam(side: Side, teamId: string | null): void {
      if (teamId !== null && !config.teams().some((team) => team.id === teamId))
        throw new Error('Team no longer exists.');
      update((next) => {
        const other = side === 'radiant' ? 'dire' : 'radiant';
        next.manual[side] = teamId;
        if (teamId !== null && next.manual[other] === teamId) next.manual[other] = null;
      });
    },
    swapManualSides(): void {
      update((next) => {
        next.manual = { radiant: next.manual.dire, dire: next.manual.radiant };
      });
    },
    adjustScore(side: Side, delta: 1 | -1): void {
      const team = sideTeam(side);
      const { sides } = view().snapshot;
      update((next) => {
        next.override ??= Object.fromEntries(
          SIDES.flatMap((s) => {
            const shown = sides[s];
            return shown === null ? [] : [[shown.key, shown.score]];
          })
        );
        next.override[team.key] = Math.max(0, (next.override[team.key] ?? 0) + delta);
      });
    },
    useAutomaticScore(): void {
      update((next) => {
        next.override = null;
      });
    },
    resetScores(): void {
      update((next) => {
        next.override = {};
      });
    },
    // Re-derives after a team rename, logo or roster change.
    refresh(): void {
      lastInputKey = null;
      lastPayloadKey = null;
      publish();
    },
    isTeamAssigned(teamId: string): boolean {
      return state.manual.radiant === teamId || state.manual.dire === teamId;
    }
  };
}
