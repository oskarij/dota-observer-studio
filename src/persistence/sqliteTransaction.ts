import type { DatabaseSync } from 'node:sqlite';

export function transaction(db: DatabaseSync, write: () => void): void {
  db.exec('BEGIN');
  try {
    write();
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
