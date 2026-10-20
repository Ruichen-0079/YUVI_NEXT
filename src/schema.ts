import { DatabaseSync } from 'node:sqlite';

export const ARCHIVE_SCHEMA = `
      CREATE TABLE IF NOT EXISTS events (
        seq INTEGER PRIMARY KEY AUTOINCREMENT,
        id TEXT NOT NULL UNIQUE, branch TEXT NOT NULL, class TEXT NOT NULL,
        kind TEXT NOT NULL, scene TEXT NOT NULL, actor TEXT NOT NULL,
        t_recorded INTEGER NOT NULL, reply_to TEXT REFERENCES events(id),
        content TEXT NOT NULL, model TEXT, meta TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS events_reply ON events(reply_to);
      CREATE TRIGGER IF NOT EXISTS events_no_update BEFORE UPDATE ON events
        BEGIN SELECT RAISE(ABORT, 'events are append-only'); END;
      CREATE TRIGGER IF NOT EXISTS events_no_delete BEFORE DELETE ON events
        BEGIN SELECT RAISE(ABORT, 'events are append-only'); END;
      CREATE TRIGGER IF NOT EXISTS events_no_replace BEFORE INSERT ON events
        WHEN EXISTS (SELECT 1 FROM events WHERE id=NEW.id OR seq=NEW.seq)
        BEGIN SELECT RAISE(ABORT, 'events are append-only'); END;
      `;

function definitions(db: DatabaseSync): string {
  return JSON.stringify(db.prepare(`SELECT type,name,tbl_name,sql FROM sqlite_master
    WHERE name NOT GLOB 'sqlite_*' ORDER BY type,name`).all().map(row => ({
      ...row, sql: typeof row.sql === 'string' ? row.sql.replace(/\s+/g, ' ').trim() : row.sql
    })));
}
const expected = new DatabaseSync(':memory:');
expected.exec(ARCHIVE_SCHEMA);
const expectedDefinitions = definitions(expected);
expected.close();

export function checkArchive(db: DatabaseSync): void {
  try {
    const result = db.prepare('PRAGMA integrity_check').all();
    if (result.length !== 1 || Object.values(result[0])[0] !== 'ok') throw new Error();
  } catch { throw new Error('SQLite integrity check failed.'); }
  if (definitions(db) !== expectedDefinitions) throw new Error('Archive schema or append-only triggers mismatch.');
}
export function checkArchiveFile(path: string): void {
  const db = new DatabaseSync(path, { readOnly: true });
  try { checkArchive(db); } finally { db.close(); }
}
