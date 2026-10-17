import { DatabaseSync } from 'node:sqlite';

import { transaction } from './sqliteTransaction.js';
import type { KnownPlayer } from '../shared/knownPlayer.js';
import { logWarning } from '../shared/logger.js';

export interface KnownPlayersStore {
  readonly warning?: string;
  list(): KnownPlayer[];
  replaceAll(players: readonly KnownPlayer[]): void;
  close(): void;
}

export function createKnownPlayersStore(filePath: string): KnownPlayersStore {
  try {
    return openKnownPlayersStore(filePath);
  } catch (error) {
    logWarning(
      `Failed to open known-players store at ${filePath}; the list will not persist`,
      error
    );
    return createMemoryPlayersStore();
  }
}

function createMemoryPlayersStore(): KnownPlayersStore {
  let players: KnownPlayer[] = [];

  return {
    warning: 'Storage could not be opened. Changes will be lost when the app closes.',
    list: () => players,
    replaceAll: (next) => {
      players = [...next];
    },
    close: () => {}
  };
}

function openKnownPlayersStore(filePath: string): KnownPlayersStore {
  const db = new DatabaseSync(filePath);
  try {
    db.exec(`
    CREATE TABLE IF NOT EXISTS known_players (
      account_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      mmr INTEGER,
      team_id TEXT
    );
  `);

    // Databases created before team links lack the column.
    const columns = db.prepare('PRAGMA table_info(known_players)').all() as { name: string }[];
    if (!columns.some((column) => column.name === 'team_id'))
      db.exec('ALTER TABLE known_players ADD COLUMN team_id TEXT');

    const readStmt = db.prepare(
      'SELECT account_id, name, mmr, team_id FROM known_players ORDER BY rowid'
    );
    const insertStmt = db.prepare(
      'INSERT INTO known_players (account_id, name, mmr, team_id) VALUES (?, ?, ?, ?)'
    );
    const clearStmt = db.prepare('DELETE FROM known_players');

    function replaceAll(players: readonly KnownPlayer[]): void {
      transaction(db, () => {
        clearStmt.run();
        for (const player of players) {
          insertStmt.run(player.accountId, player.name, player.mmr, player.teamId);
        }
      });
    }

    return {
      list() {
        const rows = readStmt.all() as {
          account_id: string;
          name: string;
          mmr: number | null;
          team_id: string | null;
        }[];

        return rows.map((row) => ({
          accountId: row.account_id,
          name: row.name,
          mmr: row.mmr,
          teamId: row.team_id
        }));
      },
      replaceAll,
      close() {
        db.close();
      }
    };
  } catch (error) {
    db.close();
    throw error;
  }
}
