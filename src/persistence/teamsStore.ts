import { transaction } from './sqliteTransaction.js';
import { DatabaseSync } from 'node:sqlite';

import { logWarning } from '../shared/logger.js';
import type { Team } from '../shared/team.js';

export interface TeamsStore {
  readonly warning?: string;
  list(): Team[];
  replaceAll(teams: readonly Team[]): void;
  upsert(team: Team): void;
  close(): void;
}

export function createTeamsStore(filePath: string): TeamsStore {
  try {
    return openTeamsStore(filePath);
  } catch (error) {
    logWarning(`Failed to open teams store at ${filePath}; teams will not persist`, error);
    return createMemoryTeamsStore();
  }
}

function createMemoryTeamsStore(): TeamsStore {
  let teams: Team[] = [];

  return {
    warning: 'Storage could not be opened. Changes will be lost when the app closes.',
    list: () => teams,
    replaceAll: (next) => {
      teams = [...next];
    },
    upsert: (team) => {
      teams = [...teams.filter((existing) => existing.id !== team.id), team];
    },
    close: () => {}
  };
}

function openTeamsStore(filePath: string): TeamsStore {
  const db = new DatabaseSync(filePath);
  try {
    db.exec(`
    CREATE TABLE IF NOT EXISTS teams (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      tag TEXT NOT NULL DEFAULT '',
      logo_path TEXT,
      external_team_id INTEGER
    );
  `);

    const readStmt = db.prepare(
      'SELECT id, name, tag, logo_path, external_team_id FROM teams ORDER BY rowid'
    );
    const upsertStmt = db.prepare(`
    INSERT INTO teams (id, name, tag, logo_path, external_team_id) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      tag = excluded.tag,
      logo_path = excluded.logo_path,
      external_team_id = excluded.external_team_id
  `);

    const clearStmt = db.prepare('DELETE FROM teams');

    interface TeamRow {
      id: string;
      name: string;
      tag: string;
      logo_path: string | null;
      external_team_id: number | null;
    }

    const toTeam = (row: TeamRow): Team => ({
      id: row.id,
      name: row.name,
      tag: row.tag,
      logoPath: row.logo_path,
      externalTeamId: row.external_team_id
    });

    function replaceAll(teams: readonly Team[]): void {
      transaction(db, () => {
        clearStmt.run();
        for (const team of teams) {
          upsertStmt.run(team.id, team.name, team.tag, team.logoPath, team.externalTeamId);
        }
      });
    }

    return {
      list() {
        return (readStmt.all() as unknown as TeamRow[]).map(toTeam);
      },
      replaceAll,
      upsert(team) {
        upsertStmt.run(team.id, team.name, team.tag, team.logoPath, team.externalTeamId);
      },
      close() {
        db.close();
      }
    };
  } catch (error) {
    db.close();
    throw error;
  }
}
