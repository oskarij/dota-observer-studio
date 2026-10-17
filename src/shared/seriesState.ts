import type { DotaGsiLeague, DotaGsiLeagueTeam } from './dotaGsiPayload.js';
import { positiveId } from './matchContext.js';
import type { Team } from './team.js';
import { isRecord } from './validation.js';

export type Side = 'radiant' | 'dire';
export const SIDES: readonly Side[] = ['radiant', 'dire'];

// Only inputs are stored; the matchup and scores shown are derived from them on every update.
export interface PersistedSeriesState {
  // The ticket of the last live match; null once a match without one is live.
  ticket: DotaGsiLeague | null;
  // The operator's matchup for lobbies without a ticket, as saved team ids.
  manual: Record<Side, string | null>;
  // The series the scores below belong to; a new key resets them.
  key: string | null;
  // Ticketed games counted here, by team key, for when neither the ticket nor Valve has the score.
  counted: Record<string, number>;
  countedMatchIds: string[];
  // The operator's score by team key; null follows the automatic score.
  override: Record<string, number> | null;
}

export interface SeriesSide {
  readonly name: string;
  readonly logoPath: string | null;
  readonly score: number;
}

export interface SeriesStatePayload {
  readonly radiant: SeriesSide;
  readonly dire: SeriesSide;
  readonly seriesConfigured: boolean;
}

export interface SeriesTeamView extends SeriesSide {
  // Identifies the team within the series: its Valve id, else its saved id, else its ticket name.
  readonly key: string;
  readonly teamId: string | null;
  readonly valveTeamId: number | null;
}

export type SeriesScoreSource = 'manual' | 'ticket' | 'history' | 'count';

export interface SeriesSnapshot {
  readonly mode: 'ticket' | 'manual';
  readonly sides: Record<Side, SeriesTeamView | null>;
  readonly scoreSource: SeriesScoreSource;
  readonly manual: Record<Side, string | null>;
  readonly league: {
    readonly leagueId: number | null;
    readonly seriesId: number | null;
    readonly name: string | null;
  } | null;
}

export function createDefaultSeriesState(): PersistedSeriesState {
  return {
    ticket: null,
    manual: { radiant: null, dire: null },
    key: null,
    counted: {},
    countedMatchIds: [],
    override: null
  };
}

export function createEmptySeriesPayload(): SeriesStatePayload {
  return {
    radiant: { name: '', logoPath: null, score: 0 },
    dire: { name: '', logoPath: null, score: 0 },
    seriesConfigured: false
  };
}

export function validWins(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function ticketTeamKey(team: DotaGsiLeagueTeam | undefined): string | null {
  const valveTeamId = positiveId(team?.team_id);
  if (valveTeamId !== null) return `valve:${valveTeamId}`;
  const name = team?.name?.trim().toLowerCase() ?? '';
  return name === '' ? null : `name:${name}`;
}

// Bo1 lobbies have no series id, so a ticket's two teams identify its series instead.
export function ticketSeriesKey(ticket: DotaGsiLeague): string | null {
  const leagueId = positiveId(ticket.league_id) ?? 0;
  const seriesId = positiveId(ticket.series_id);
  if (seriesId !== null) return `${leagueId}:series:${seriesId}`;
  const teams = [ticketTeamKey(ticket.radiant), ticketTeamKey(ticket.dire)];
  return teams.includes(null) ? null : `${leagueId}:teams:${teams.sort().join('|')}`;
}

export function manualSeriesKey(manual: Record<Side, string | null>): string | null {
  if (manual.radiant === null || manual.dire === null) return null;
  return `manual:${[manual.radiant, manual.dire].sort().join('|')}`;
}

export function seriesKeyOf(state: PersistedSeriesState): string | null {
  return state.ticket === null ? manualSeriesKey(state.manual) : ticketSeriesKey(state.ticket);
}

// With a ticket, its teams on its sides, linked to saved teams by Valve id; otherwise the
// operator's matchup. Scores: the operator's, else the ticket's, else Valve history, else counted.
export function resolveSeries(
  state: PersistedSeriesState,
  teams: readonly Team[],
  history: Readonly<Record<number, number>> | null
): { snapshot: SeriesSnapshot; payload: SeriesStatePayload } {
  const { ticket } = state;
  const fromTicket = (team: DotaGsiLeagueTeam | undefined) => {
    const key = ticketTeamKey(team);
    if (key === null) return null;
    const valveTeamId = positiveId(team?.team_id);
    const saved =
      valveTeamId === null
        ? undefined
        : teams.find((candidate) => candidate.externalTeamId === valveTeamId);
    return {
      key,
      teamId: saved?.id ?? null,
      valveTeamId,
      name: saved?.name ?? (team?.name?.trim() || `Team ${String(valveTeamId)}`),
      logoPath: saved?.logoPath ?? null
    };
  };
  const fromManual = (teamId: string | null) => {
    const saved = teams.find((candidate) => candidate.id === teamId);
    if (saved === undefined) return null;
    const { id, externalTeamId: valveTeamId, name, logoPath } = saved;
    return { key: id, teamId: id, valveTeamId, name, logoPath };
  };
  const teamsBySide = {
    radiant: ticket === null ? fromManual(state.manual.radiant) : fromTicket(ticket.radiant),
    dire: ticket === null ? fromManual(state.manual.dire) : fromTicket(ticket.dire)
  };

  const ticketWins = (side: Side): number | undefined => ticket?.[side]?.series_wins;
  const historyWins = (side: Side): number | undefined => {
    const valveTeamId = teamsBySide[side]?.valveTeamId;
    return valveTeamId === null || valveTeamId === undefined ? undefined : history?.[valveTeamId];
  };
  const both = (wins: (side: Side) => number | undefined) =>
    ticket !== null && validWins(wins('radiant')) && validWins(wins('dire'));
  let scoreSource: SeriesScoreSource = 'count';
  if (state.override !== null) scoreSource = 'manual';
  else if (both(ticketWins)) scoreSource = 'ticket';
  else if (both(historyWins)) scoreSource = 'history';

  const score = (side: Side, key: string): number => {
    if (scoreSource === 'manual') return state.override?.[key] ?? 0;
    if (scoreSource === 'ticket') return ticketWins(side) ?? 0;
    if (scoreSource === 'history') return historyWins(side) ?? 0;
    return state.counted[key] ?? 0;
  };
  const sideView = (side: Side): SeriesTeamView | null => {
    const team = teamsBySide[side];
    return team === null ? null : { ...team, score: score(side, team.key) };
  };
  const sides = { radiant: sideView('radiant'), dire: sideView('dire') };
  const payloadSide = (side: Side): SeriesSide => {
    const view = sides[side];
    return view === null
      ? { name: '', logoPath: null, score: 0 }
      : { name: view.name, logoPath: view.logoPath, score: view.score };
  };

  return {
    snapshot: {
      mode: ticket === null ? 'manual' : 'ticket',
      sides,
      scoreSource,
      manual: { ...state.manual },
      league:
        ticket === null
          ? null
          : {
              leagueId: positiveId(ticket.league_id),
              seriesId: positiveId(ticket.series_id),
              name: ticket.name?.trim() || null
            }
    },
    payload: {
      radiant: payloadSide('radiant'),
      dire: payloadSide('dire'),
      seriesConfigured: sides.radiant !== null && sides.dire !== null
    }
  };
}

const isWinsRecord = (value: unknown): value is Record<string, number> =>
  isRecord(value) && Object.values(value).every(validWins);
const isTeamRef = (value: unknown): value is string | null =>
  value === null || typeof value === 'string';

// State saved by an older version (or edited by hand) starts a fresh series instead of failing.
export function parsePersistedSeriesState(value: unknown): PersistedSeriesState {
  if (
    isRecord(value) &&
    (value.ticket === null || isRecord(value.ticket)) &&
    isRecord(value.manual) &&
    isTeamRef(value.manual.radiant) &&
    isTeamRef(value.manual.dire) &&
    (value.key === null || typeof value.key === 'string') &&
    isWinsRecord(value.counted) &&
    Array.isArray(value.countedMatchIds) &&
    value.countedMatchIds.every((id) => typeof id === 'string') &&
    (value.override === null || isWinsRecord(value.override))
  ) {
    return value as unknown as PersistedSeriesState;
  }
  return createDefaultSeriesState();
}
