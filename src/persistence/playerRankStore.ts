import { DatabaseSync } from 'node:sqlite';

import { logWarning } from '../shared/logger.js';

// OpenDota rank_tier cache by account id. A null rankTier is a cached answer: no public rank.
export interface PlayerRankRecord {
  readonly rankTier: number | null;
  readonly fetchedAt: number;
}

export interface PlayerRankStore {
  get(accountId: string): PlayerRankRecord | null;
  set(accountId: string, rankTier: number | null, fetchedAt: number): void;
  deleteAll(): void;
  close(): void;
}

export function createPlayerRankStore(filePath: string): PlayerRankStore {
  // A corrupt or locked file must not block startup; fall back to a store that caches nothing.
  try {
    return openPlayerRankStore(filePath);
  } catch (error) {
    logWarning(`Failed to open player rank store at ${filePath}; ranks will not be cached`, error);
    return createNoopPlayerRankStore();
  }
}

function createNoopPlayerRankStore(): PlayerRankStore {
  return {
    get: () => null,
    set: () => {},
    deleteAll: () => {},
    close: () => {}
  };
}

function openPlayerRankStore(filePath: string): PlayerRankStore {
  const db = new DatabaseSync(filePath);

  db.exec(`
    CREATE TABLE IF NOT EXISTS player_ranks (
      account_id TEXT PRIMARY KEY,
      rank_tier INTEGER,
      fetched_at INTEGER NOT NULL
    );
  `);
  db.exec('PRAGMA user_version = 1;');

  const readStmt = db.prepare(
    'SELECT rank_tier, fetched_at FROM player_ranks WHERE account_id = ?'
  );
  const writeStmt = db.prepare(
    `INSERT INTO player_ranks (account_id, rank_tier, fetched_at)
     VALUES (?, ?, ?)
     ON CONFLICT(account_id) DO UPDATE SET rank_tier = excluded.rank_tier, fetched_at = excluded.fetched_at`
  );

  return {
    get(accountId) {
      const row = readStmt.get(accountId) as
        | { rank_tier: number | null; fetched_at: number }
        | undefined;

      if (row === undefined) {
        return null;
      }

      return { fetchedAt: row.fetched_at, rankTier: row.rank_tier };
    },
    set(accountId, rankTier, fetchedAt) {
      writeStmt.run(accountId, rankTier, fetchedAt);
    },
    deleteAll() {
      db.exec('DELETE FROM player_ranks');
    },
    close() {
      db.close();
    }
  };
}
