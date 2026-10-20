import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

export interface Event {
  seq: number; id: string; branch: string; class: string; kind: string;
  scene: string; actor: string; t_recorded: number; reply_to: string | null;
  content: string; model: string | null; meta: Record<string, unknown>;
}
export class DataDirectoryInUseError extends Error {
  constructor() { super('YUVI_DATA_DIR is already in use; stop the other instance first.'); }
}

export class Archive {
  readonly db: DatabaseSync;
  private readonly instanceLock: DatabaseSync;
  constructor(directory: string) {
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    // This persistent coordination file is never unlinked: replacing its inode
    // could let two processes acquire different locks for the same directory.
    this.instanceLock = new DatabaseSync(join(directory, 'service.lock'));
    let db: DatabaseSync | undefined;
    try {
      try {
        // Hold the service lock before even opening the archive. Readers and
        // snapshot processes only open archive.sqlite, so never contend here.
        this.instanceLock.exec(`PRAGMA busy_timeout=0;
          PRAGMA locking_mode=EXCLUSIVE;
          BEGIN EXCLUSIVE; COMMIT;`);
      } catch (error) {
        const code = (error as { errcode?: number }).errcode;
        if (code !== undefined && [5, 6].includes(code & 0xff)) throw new DataDirectoryInUseError();
        throw error;
      }
      this.db = db = new DatabaseSync(join(directory, 'archive.sqlite'));
      this.db.exec(`
      PRAGMA journal_mode=WAL;
      PRAGMA synchronous=FULL;
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
      `);
    } catch (error) {
      try { db?.close(); } finally { this.instanceLock.close(); }
      throw error;
    }
  }
  append(input: Pick<Event, 'class' | 'kind' | 'actor'> & Partial<Pick<Event, 'reply_to' | 'content' | 'model' | 'meta'>>): Event {
    const event = { id: randomUUID(), branch: 'dev:v2-dev', scene: 'web',
      t_recorded: Date.now(), reply_to: null, content: '', model: null, meta: {}, ...input };
    const result = this.db.prepare(`INSERT INTO events
      (id,branch,class,kind,scene,actor,t_recorded,reply_to,content,model,meta)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(event.id, event.branch, event.class,
      event.kind, event.scene, event.actor, event.t_recorded, event.reply_to,
      event.content, event.model, JSON.stringify(event.meta));
    return { ...event, seq: Number(result.lastInsertRowid) };
  }
  private decode(rows: Record<string, unknown>[]): Event[] {
    return rows.map(row => ({ ...row, meta: JSON.parse(row.meta as string) }) as Event);
  }
  events(after = 0): Event[] {
    return this.decode(this.db.prepare('SELECT * FROM events WHERE seq > ? ORDER BY seq').all(after));
  }
  context(limit: number): Event[] {
    return this.decode(this.db.prepare(`SELECT * FROM (
      SELECT * FROM events WHERE scene='web' AND
      ((class='experience' AND kind='heard') OR (class='act' AND kind IN ('said','silent')))
      ORDER BY seq DESC LIMIT ?) ORDER BY seq`).all(limit));
  }
  usage(): Record<string, unknown>[] {
    const days = new Map<string, Record<string, unknown>>();
    const rows = this.decode(this.db.prepare(`SELECT * FROM events WHERE
      (class='act' AND kind IN ('said','silent')) OR (class='control' AND kind='error')
      ORDER BY seq`).all());
    function sum(target: Record<string, unknown>, source: Record<string, unknown>, top = true): void {
      for (const [key, value] of Object.entries(source)) {
        if (top && ['date', 'turns', 'turns_with_usage'].includes(key)) continue;
        if (typeof value === 'number' && Number.isFinite(value)) {
          target[key] = Number(typeof target[key] === 'number' ? target[key] : 0) + value;
        } else if (value && typeof value === 'object' && !Array.isArray(value)) {
          if (!Object.hasOwn(target, key) || typeof target[key] !== 'object') target[key] = Object.create(null);
          sum(target[key] as Record<string, unknown>, value as Record<string, unknown>, false);
        }
      }
    }
    for (const event of rows) {
      const date = new Date(event.t_recorded).toISOString().slice(0, 10);
      const day = days.get(date) ?? Object.assign(Object.create(null), {
        date, turns: 0, turns_with_usage: 0, prompt_tokens: 0, completion_tokens: 0
      });
      day.turns = Number(day.turns) + 1;
      const usage = event.meta.usage;
      if (usage && typeof usage === 'object' && !Array.isArray(usage)) {
        day.turns_with_usage = Number(day.turns_with_usage) + 1;
        sum(day, usage as Record<string, unknown>);
      }
      days.set(date, day);
    }
    return [...days.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, day]) => day);
  }
  recover(): void {
    const pending = this.decode(this.db.prepare(`SELECT * FROM events h
      WHERE h.class='experience' AND h.kind='heard' AND NOT EXISTS
      (SELECT 1 FROM events r WHERE r.reply_to=h.id AND
      ((r.class='act' AND r.kind IN ('said','silent')) OR (r.class='control' AND r.kind='error')))
      ORDER BY h.seq`).all());
    for (const heard of pending) {
      const attempt = this.db.prepare("SELECT id FROM events WHERE reply_to=? AND kind='reply_attempt' ORDER BY seq DESC LIMIT 1").get(heard.id);
      this.append({ class: 'control', kind: 'error', actor: 'system', reply_to: heard.id,
        meta: { reason: 'interrupted', outcome: attempt ? 'unknown' : 'not_sent',
          ...(attempt ? { attempt: attempt.id } : {}) } });
    }
  }
  close(): void {
    try { this.db.close(); } finally { this.instanceLock.close(); }
  }
}
