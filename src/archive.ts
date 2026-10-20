import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

export interface Event {
  seq: number; id: string; branch: string; class: string; kind: string;
  scene: string; actor: string; t_recorded: number; reply_to: string | null;
  content: string; model: string | null; meta: Record<string, unknown>;
}
export class Archive {
  readonly db: DatabaseSync;
  constructor(directory: string) {
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(join(directory, 'archive.sqlite'));
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
  context(limit: number, throughHeard = Number.MAX_SAFE_INTEGER): Event[] {
    return this.decode(this.db.prepare(`SELECT * FROM (
      SELECT * FROM events WHERE scene='web' AND
      ((class='experience' AND kind='heard' AND seq <= ?) OR (class='act' AND kind='said'))
      ORDER BY seq DESC LIMIT ?) ORDER BY seq`).all(throughHeard, limit));
  }
  recover(): void {
    const pending = this.decode(this.db.prepare(`SELECT * FROM events h
      WHERE h.class='experience' AND h.kind='heard' AND NOT EXISTS
      (SELECT 1 FROM events r WHERE r.reply_to=h.id AND
      ((r.class='act' AND r.kind='said') OR (r.class='control' AND r.kind='error')))
      ORDER BY h.seq`).all());
    for (const heard of pending) {
      const attempt = this.db.prepare("SELECT id FROM events WHERE reply_to=? AND kind='reply_attempt' ORDER BY seq DESC LIMIT 1").get(heard.id);
      this.append({ class: 'control', kind: 'error', actor: 'system', reply_to: heard.id,
        meta: { reason: 'interrupted', outcome: attempt ? 'unknown' : 'not_sent',
          ...(attempt ? { attempt: attempt.id } : {}) } });
    }
  }
  close(): void { this.db.close(); }
}
