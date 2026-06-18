import { DatabaseSync } from 'node:sqlite';

import { logWarning } from '../shared/logger.js';

// Persistent cache of OpenDota rank_tier keyed by account id, so the in-game medal isn't refetched
// for every seen player. node:sqlite (built into Electron's Node) is used instead of better-sqlite3,
// whose prebuilt native binary doesn't match Electron's ABI. A null rankTier is a real, cached value
// ("checked, no public rank"); fetchedAt drives the staleness/TTL check in playerRankService.
export interface PlayerRankRecord {
  readonly rankTier: number | null;
  readonly fetchedAt: number;
}

export interface PlayerRankStore {
  get(accountId: string): PlayerRankRecord | null;
  set(accountId: string, rankTier: number | null, fetchedAt: number): void;
  close(): void;
}

export function createPlayerRankStore(filePath: string): PlayerRankStore {
  // The rank cache is a nice-to-have, not load-bearing — a corrupt or locked DB file must not block
  // app startup. On failure we degrade to a no-op store so the medal path just refetches each run.
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
    close() {
      db.close();
    }
  };
}
