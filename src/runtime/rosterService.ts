import type { KnownPlayersStore } from '../persistence/knownPlayersStore.js';
import type { TeamsStore } from '../persistence/teamsStore.js';
import type { KnownPlayer } from '../shared/knownPlayer.js';
import { errorMessage, type Result } from '../shared/result.js';
import { isKnownPlayer, isTeam, type RosterSnapshot } from '../shared/roster.js';
import { isRecord } from '../shared/validation.js';
import type { Team } from '../shared/team.js';

export interface RosterServiceOptions {
  teams: TeamsStore;
  players: KnownPlayersStore;
  onTeamsChanged(): void;
  onPlayersChanged(): void;
  isTeamAssigned(id: string): boolean;
}

export function createRosterService(options: RosterServiceOptions) {
  const { teams, players } = options;
  const getTeams = (): RosterSnapshot<Team> => ({
    items: teams.list(),
    warning: teams.warning ?? null
  });
  const getPlayers = (): RosterSnapshot<KnownPlayer> => ({
    items: players.list(),
    warning: players.warning ?? null
  });

  function save(write: () => void, changed: () => void): Result {
    try {
      write();
      changed();
      return { ok: true };
    } catch (error) {
      return { ok: false, reason: errorMessage(error) };
    }
  }

  function validPlayer(player: unknown): player is KnownPlayer {
    return (
      isKnownPlayer(player) &&
      (player.teamId === null || teams.list().some((team) => team.id === player.teamId))
    );
  }

  return {
    getTeams,
    getPlayers,
    addTeam(value: unknown) {
      if (!isTeam(value) || teams.list().some((team) => team.id === value.id)) {
        return { ok: false, reason: 'Invalid or duplicate team.' } as const;
      }
      return save(() => teams.upsert(value), options.onTeamsChanged);
    },
    updateTeam(id: unknown, patch: unknown) {
      const current = teams.list().find((team) => team.id === id);
      if (
        !current ||
        !isRecord(patch) ||
        Object.keys(patch).some(
          (key) => !['name', 'tag', 'logoPath', 'externalTeamId'].includes(key)
        )
      ) {
        return { ok: false, reason: 'Invalid team edit.' } as const;
      }
      const next = { ...current, ...patch };
      if (!isTeam(next)) return { ok: false, reason: 'Invalid team details.' } as const;
      // A Valve id links league tickets to one saved team only.
      if (
        next.externalTeamId !== null &&
        teams.list().some((team) => team.id !== id && team.externalTeamId === next.externalTeamId)
      )
        return { ok: false, reason: 'Another team already has that Valve team ID.' } as const;
      return save(() => teams.upsert(next), options.onTeamsChanged);
    },
    removeTeam(id: unknown) {
      if (typeof id !== 'string' || !teams.list().some((team) => team.id === id)) {
        return { ok: false, reason: 'Team no longer exists.' } as const;
      }
      if (players.list().some((player) => player.teamId === id) || options.isTeamAssigned(id)) {
        return {
          ok: false,
          reason: 'Unassign the team from its players and series before deleting it.'
        } as const;
      }
      return save(
        () => teams.replaceAll(teams.list().filter((team) => team.id !== id)),
        options.onTeamsChanged
      );
    },
    addPlayer(value: unknown) {
      if (
        !validPlayer(value) ||
        players.list().some((player) => player.accountId === value.accountId)
      ) {
        return { ok: false, reason: 'Invalid or duplicate player, or unknown team.' } as const;
      }
      return save(() => players.replaceAll([...players.list(), value]), options.onPlayersChanged);
    },
    updatePlayer(id: unknown, patch: unknown) {
      const current = players.list().find((player) => player.accountId === id);
      if (
        !current ||
        !isRecord(patch) ||
        Object.keys(patch).some((key) => !['name', 'mmr', 'teamId'].includes(key))
      ) {
        return { ok: false, reason: 'Invalid player edit.' } as const;
      }
      const next = { ...current, ...patch };
      if (!validPlayer(next))
        return { ok: false, reason: 'Invalid player details or unknown team.' } as const;
      return save(
        () =>
          players.replaceAll(
            players.list().map((player) => (player.accountId === id ? next : player))
          ),
        options.onPlayersChanged
      );
    },
    removePlayer(id: unknown) {
      if (typeof id !== 'string') return { ok: false, reason: 'Invalid player account.' } as const;
      return save(
        () => players.replaceAll(players.list().filter((player) => player.accountId !== id)),
        options.onPlayersChanged
      );
    },
    replacePlayers(value: unknown) {
      if (
        !Array.isArray(value) ||
        !value.every(validPlayer) ||
        new Set(value.map((player) => player.accountId)).size !== value.length
      ) {
        return {
          ok: false,
          reason: 'The player list contains invalid accounts, duplicates or unknown teams.'
        } as const;
      }
      return save(() => players.replaceAll(value), options.onPlayersChanged);
    }
  };
}

export type RosterService = ReturnType<typeof createRosterService>;
