import type { FearlessStore } from '../persistence/fearlessRepository.js';
import type { KnownPlayersStore } from '../persistence/knownPlayersStore.js';
import type { TeamsStore } from '../persistence/teamsStore.js';
import type { OverlayGsiEventStream } from '../runtime/overlayGsiEventStream.js';
import { createRosterService } from '../runtime/rosterService.js';
import { createSeriesSession } from '../runtime/seriesSession.js';
import type { ValveClient } from '../runtime/valveClient.js';
import {
  FEARLESS_SERIES_CHANGED_CHANNEL,
  KNOWN_PLAYERS_CHANGED_CHANNEL,
  SERIES_CHANGED_CHANNEL,
  TEAMS_CHANGED_CHANNEL,
  TOURNAMENT_CHANGED_CHANNEL,
  WATCHED_GAMES_CHANGED_CHANNEL
} from '../shared/ipcChannels.js';
import type { PersistedSeriesState } from '../shared/seriesState.js';
import { registerFearlessDraftIpc } from './ipc/fearlessDraft.js';
import { registerKnownPlayersIpc } from './ipc/knownPlayers.js';
import { registerSeriesIpc } from './ipc/series.js';
import { registerTeamsIpc } from './ipc/teams.js';
import { registerTournamentIpc } from './ipc/tournament.js';
import type { TournamentStore } from './tournamentStore.js';

export interface StudioServicesDeps {
  eventStream: Pick<
    OverlayGsiEventStream,
    'setSeriesState' | 'setFearlessSeries' | 'setKnownPlayers'
  >;
  teams: TeamsStore;
  players: KnownPlayersStore;
  fearless: FearlessStore;
  series: { get(): unknown; set(state: PersistedSeriesState): void };
  tournament: TournamentStore;
  valve: Pick<ValveClient, 'fetchLeagueMatches' | 'fetchMatchInfo'>;
  mediaRoot: string;
  broadcast(channel: string): void;
  schedule?: (run: () => void, delayMs: number) => () => void;
}

// The series, roster and fearless services and their IPC, shared by main and the integration test.
export function registerStudioServices(deps: StudioServicesDeps) {
  const { eventStream, teams, players, broadcast } = deps;
  const session = createSeriesSession({
    fearless: deps.fearless,
    series: {
      store: deps.series,
      teams: () => teams.list(),
      upsertTeam: (team) => {
        teams.upsert(team);
        broadcast(TEAMS_CHANGED_CHANNEL);
      },
      knownPlayers: () => players.list(),
      sink: eventStream,
      notifyChanged: () => broadcast(SERIES_CHANGED_CHANNEL)
    },
    tournament: {
      store: deps.tournament,
      fetchLeagueMatches: deps.valve.fetchLeagueMatches,
      notifyChanged: () => broadcast(TOURNAMENT_CHANGED_CHANNEL),
      ...(deps.schedule === undefined ? {} : { schedule: deps.schedule })
    },
    fetchMatch: deps.valve.fetchMatchInfo,
    publishPicks: (bannedHeroIds) => eventStream.setFearlessSeries({ bannedHeroIds }),
    notifyPicks: () => broadcast(FEARLESS_SERIES_CHANGED_CHANNEL),
    notifyWatched: () => broadcast(WATCHED_GAMES_CHANGED_CHANNEL)
  });
  const roster = createRosterService({
    teams,
    players,
    isTeamAssigned: (id) => session.series.isTeamAssigned(id),
    onTeamsChanged: () => {
      session.series.refresh();
      broadcast(TEAMS_CHANGED_CHANNEL);
    },
    onPlayersChanged: () => {
      eventStream.setKnownPlayers(players.list());
      session.series.refresh();
      broadcast(KNOWN_PLAYERS_CHANGED_CHANNEL);
    }
  });
  const unregister = [
    registerKnownPlayersIpc(roster, eventStream),
    registerFearlessDraftIpc(session.fearless),
    registerTeamsIpc(roster, deps.mediaRoot),
    registerSeriesIpc(session.series),
    registerTournamentIpc(session.tournament, deps.tournament)
  ];
  session.series.refresh();

  return {
    session,
    roster,
    dispose(): void {
      for (const off of unregister) off();
      session.dispose();
    }
  };
}
