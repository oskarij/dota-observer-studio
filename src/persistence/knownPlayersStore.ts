import { DatabaseSync } from 'node:sqlite';

import { DEFAULT_KNOWN_PLAYERS } from '../shared/defaultKnownPlayers.js';
import type { KnownPlayer } from '../shared/knownPlayer.js';
import { logWarning } from '../shared/logger.js';

// Persistent, user-editable list of curated players keyed by account id. node:sqlite (built into
// Electron's Node) is used to match the rest of the persistence layer; see playerRankStore for why
// not better-sqlite3. The whole list is read and written at once (it's small and the UI edits it
// as a single working set), so writes go through replaceAll() in a transaction.
export interface KnownPlayersStore {
  list(): KnownPlayer[];
  replaceAll(players: readonly KnownPlayer[]): void;
  close(): void;
}

export function createKnownPlayersStore(filePath: string): KnownPlayersStore {
  // The known-players list shouldn't block app startup if the DB is corrupt or locked: degrade to
  // an in-memory no-op (the seeded defaults are gone, but the studio still opens and the user can
  // re-add players for the session).
  try {
    return openKnownPlayersStore(filePath);
  } catch (error) {
    logWarning(
      `Failed to open known-players store at ${filePath}; the list will not persist`,
      error
    );
    return createNoopKnownPlayersStore();
  }
}

function createNoopKnownPlayersStore(): KnownPlayersStore {
  let players: KnownPlayer[] = [];

  return {
    list: () => players,
    replaceAll: (next) => {
      players = [...next];
    },
    close: () => {}
  };
}

function openKnownPlayersStore(filePath: string): KnownPlayersStore {
  const db = new DatabaseSync(filePath);

  db.exec(`
    CREATE TABLE IF NOT EXISTS known_players (
      account_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      mmr INTEGER
    );
  `);

  const readStmt = db.prepare('SELECT account_id, name, mmr FROM known_players ORDER BY rowid');
  const insertStmt = db.prepare(
    'INSERT INTO known_players (account_id, name, mmr) VALUES (?, ?, ?)'
  );
  const clearStmt = db.prepare('DELETE FROM known_players');

  function replaceAll(players: readonly KnownPlayer[]): void {
    // Whole-list swap kept atomic so a failed write never leaves a half-applied list.
    db.exec('BEGIN');
    try {
      clearStmt.run();
      for (const player of players) {
        insertStmt.run(player.accountId, player.name, player.mmr);
      }
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }

  // user_version 0 = freshly created (never seeded). Seed the curated defaults once, then bump it so
  // a user who later empties the list isn't re-seeded on the next launch.
  const { user_version: version } = db.prepare('PRAGMA user_version').get() as {
    user_version: number;
  };
  if (version === 0) {
    replaceAll(DEFAULT_KNOWN_PLAYERS);
    db.exec('PRAGMA user_version = 1');
  }

  return {
    list() {
      const rows = readStmt.all() as { account_id: string; name: string; mmr: number | null }[];

      return rows.map((row) => ({ accountId: row.account_id, name: row.name, mmr: row.mmr }));
    },
    replaceAll,
    close() {
      db.close();
    }
  };
}
