import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { mkdirSync, existsSync } from 'node:fs';
import { ARCHIVE_SCHEMA, checkArchiveFile } from './schema.js';
import { join } from 'node:path';

export const CURRENT_SCOPE = { scene: 'web', branch: 'dev:v2-dev' } as const;
const dialogueWhere = "((class='experience' AND kind='heard') OR (class='act' AND kind IN ('said','silent')))";
const endingWhere = "((r.class='act' AND r.kind IN ('said','silent')) OR (r.class='control' AND r.kind='error'))";

export interface Event {
  seq: number; id: string; branch: string; class: string; kind: string;
  scene: string; actor: string; t_recorded: number; reply_to: string | null;
  content: string; model: string | null; meta: Record<string, unknown>;
}
export class DataDirectoryInUseError extends Error {
  constructor() { super('YUVI_DATA_DIR is already in use; stop the other instance first.'); }
}

export class ArchiveIntegrityError extends Error {
  constructor() { super('YUVI_DATA_DIR archive integrity check failed; restore from a snapshot into a new directory.'); }
}

export class Archive {
  readonly db: DatabaseSync;
  private readonly instanceLock: DatabaseSync;
  // Rebuildable numeric metadata only: event bodies remain exclusively in SQLite.
  private readonly dialogueSeqs: number[] = [];
  private readonly writingSeqs: number[] = [];
  private readonly writingLengths: number[] = [];
  private readonly unfinished = new Map<string, number>();
  private covered = 0;
  private readonly truncatesAtNul: boolean;
  private lastDialogueTime: number | undefined;
  constructor(directory: string, readonly scope: { scene: string; branch: string } = CURRENT_SCOPE) {
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
      const archivePath = join(directory, 'archive.sqlite');
      if (existsSync(archivePath)) {
        try { checkArchiveFile(archivePath); } catch { throw new ArchiveIntegrityError(); }
      }
      this.db = db = new DatabaseSync(archivePath);
      this.db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;');
      this.db.exec(ARCHIVE_SCHEMA);
      // Node 22's SQLite TEXT conversion stops at NUL (later Node versions do not).
      // Preserve the P4 decoded-string semantics on the running Node version.
      this.truncatesAtNul = (this.db.prepare("SELECT CAST(x'610062' AS TEXT) AS value").get()!.value as string).length === 1;
      this.rebuildProgress();
    } catch (error) {
      try { db?.close(); } finally { this.instanceLock.close(); }
      throw error;
    }
  }
  append(input: Pick<Event, 'class' | 'kind' | 'actor'> & Partial<Pick<Event, 'reply_to' | 'content' | 'model' | 'meta'>>): Event {
    const event = { id: randomUUID(), ...this.scope,
      t_recorded: Date.now(), reply_to: null, content: '', model: null, meta: {}, ...input };
    const result = this.db.prepare(`INSERT INTO events
      (id,branch,class,kind,scene,actor,t_recorded,reply_to,content,model,meta)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(event.id, event.branch, event.class,
      event.kind, event.scene, event.actor, event.t_recorded, event.reply_to,
      event.content, event.model, JSON.stringify(event.meta));
    const saved = { ...event, seq: Number(result.lastInsertRowid) };
    this.advanceProgress(saved);
    return saved;
  }
  private decode(rows: Record<string, unknown>[]): Event[] {
    return rows.map(row => ({ ...row, meta: JSON.parse(row.meta as string) }) as Event);
  }
  events(after = 0): Event[] {
    return this.decode(this.db.prepare('SELECT * FROM events WHERE seq > ? ORDER BY seq').all(after));
  }
  private rebuildProgress(): void {
    const params = [this.scope.scene, this.scope.branch];
    for (const row of this.db.prepare(`SELECT seq,t_recorded FROM events NOT INDEXED
      WHERE scene=? AND branch=? AND ${dialogueWhere} ORDER BY seq`).iterate(...params)) {
      this.dialogueSeqs.push(Number(row.seq));
      this.lastDialogueTime = Number(row.t_recorded);
    }
    this.covered = Number(this.db.prepare(`SELECT max(CAST(json_extract(meta,'$.material.through_seq') AS REAL)) AS c
      FROM events NOT INDEXED WHERE scene=? AND branch=? AND
      ((class='inner' AND kind='wrote') OR (class='control' AND kind='unconsolidated'))`).get(...params)!.c ?? 0);
    this.covered = Math.max(0, this.covered);
    for (const row of this.db.prepare(`SELECT seq,content FROM events NOT INDEXED
      WHERE scene=? AND branch=? AND class='inner' AND kind='wrote' AND ${this.nonempty()} ORDER BY seq`).iterate(...params)) {
      this.writingSeqs.push(Number(row.seq)); this.writingLengths.push((row.content as string).length);
    }
    for (const row of this.db.prepare(`SELECT h.id,h.seq FROM events h NOT INDEXED
      WHERE h.scene=? AND h.branch=? AND h.class='experience' AND h.kind='heard' AND NOT EXISTS
      (SELECT 1 FROM events r WHERE r.reply_to=h.id AND r.scene=h.scene AND r.branch=h.branch AND ${endingWhere})
      ORDER BY h.seq`).iterate(...params)) this.unfinished.set(row.id as string, Number(row.seq));
  }
  private advanceProgress(e: Event): void {
    if (e.scene !== this.scope.scene || e.branch !== this.scope.branch) return;
    if ((e.class === 'experience' && e.kind === 'heard') || (e.class === 'act' && ['said', 'silent'].includes(e.kind))) {
      this.dialogueSeqs.push(e.seq); this.lastDialogueTime = e.t_recorded;
    }
    if (e.class === 'experience' && e.kind === 'heard') this.unfinished.set(e.id, e.seq);
    if (e.reply_to && ((e.class === 'act' && ['said', 'silent'].includes(e.kind)) || (e.class === 'control' && e.kind === 'error'))) this.unfinished.delete(e.reply_to);
    if ((e.class === 'inner' && e.kind === 'wrote') || (e.class === 'control' && e.kind === 'unconsolidated')) {
      this.covered = Math.max(this.covered, (e.meta.material as { through_seq?: number } | undefined)?.through_seq ?? 0);
    }
    const length = this.truncatesAtNul ? e.content.split('\0', 1)[0].length : e.content.length;
    if (e.class === 'inner' && e.kind === 'wrote' && length !== 0) {
      this.writingSeqs.push(e.seq); this.writingLengths.push(length);
    }
  }
  private position(seq: number, inclusive: boolean): number {
    let low = 0, high = this.dialogueSeqs.length;
    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      if (this.dialogueSeqs[mid] < seq || (inclusive && this.dialogueSeqs[mid] === seq)) low = mid + 1;
      else high = mid;
    }
    return low;
  }
  progress() {
    const coveredCount = this.position(this.covered, true);
    const firstPending = this.unfinished.values().next().value ?? Infinity;
    return { dialogueCount: this.dialogueSeqs.length, covered: this.covered, coveredCount,
      pendingCount: this.dialogueSeqs.length - coveredCount,
      materialCount: Math.max(0, this.position(firstPending, false) - coveredCount),
      firstPending, lastDialogueTime: this.lastDialogueTime };
  }
  private bySeq(seqs: number[]): Event[] {
    const result: Event[] = [];
    for (let offset = 0; offset < seqs.length; offset += 256) {
      const batch = seqs.slice(offset, offset + 256);
      result.push(...this.decode(this.db.prepare(`SELECT * FROM events WHERE seq IN (${batch.map(() => '?').join(',')}) ORDER BY seq`).all(...batch)));
    }
    return result;
  }
  dialogue(start: number, count?: number): Event[] {
    return this.bySeq(this.dialogueSeqs.slice(start, count === undefined ? undefined : start + count));
  }
  materials(limit: number): Event[] {
    const p = this.progress();
    return this.dialogue(p.coveredCount, Math.min(limit, p.materialCount));
  }
  writings(budget: number): Event[] {
    const seqs: number[] = []; let chars = 0;
    for (let i = this.writingSeqs.length - 1; i >= 0; i--) {
      const length = this.writingLengths[i];
      if (seqs.length && chars + length > budget) break;
      seqs.push(this.writingSeqs[i]); chars += length;
    }
    return this.bySeq(seqs.reverse());
  }
  private nonempty(): string { return this.truncatesAtNul ? 'length(content)>0' : "content<>''"; }
  search(query: string, from: number, to: number): { results: Event[]; total: number } {
    // instr is case-sensitive, treats %/_ literally, and preserves embedded NUL.
    // Lone UTF-16 surrogates cannot be bound losslessly as UTF-8. In that rare case
    // keep the query in the connection-local callback so includes remains exact.
    const loneSurrogate = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(query);
    if (this.truncatesAtNul && query.includes('\0')) return { results: [], total: 0 };
    if (loneSurrogate) this.db.function('check_substring', { deterministic: true }, value =>
      (this.truncatesAtNul ? (value as string).split('\0', 1)[0] : value as string).includes(query) ? 1 : 0);
    const match = loneSurrogate ? 'check_substring(content)>0' :
      `instr(content,?)>0${this.truncatesAtNul ? ' AND (instr(content,char(0))=0 OR instr(content,?)+length(?)<=instr(content,char(0)))' : ''}`;
    const predicate = `scene=? AND branch=? AND (${dialogueWhere} OR (class='inner' AND kind='wrote' AND ${this.nonempty()}))
      AND t_recorded>=? AND t_recorded<=? AND ${match}`;
    const params = [this.scope.scene, this.scope.branch, from, to, ...(loneSurrogate ? [] : this.truncatesAtNul ? [query, query, query] : [query])];
    const total = Number(this.db.prepare(`SELECT count(*) AS n FROM events NOT INDEXED WHERE ${predicate}`).get(...params)!.n);
    if (!total) return { results: [], total };
    const results: Event[] = []; let chars = 0;
    for (const row of this.db.prepare(`SELECT * FROM events NOT INDEXED WHERE ${predicate} ORDER BY seq DESC LIMIT 40`).iterate(...params)) {
      const length = (row.content as string).length;
      if (results.length && chars + length > 16000) break;
      results.push(...this.decode([row])); chars += length;
    }
    return { results: results.reverse(), total };
  }
  scanRanks(query: string, from: number, to: number): number[] {
    this.db.function('scan_rank_match', { deterministic: true }, value =>
      (this.truncatesAtNul ? (value as string).split('\0', 1)[0] : value as string).includes(query) ? 1 : 0);
    return this.db.prepare(`SELECT seq FROM events NOT INDEXED WHERE scene=? AND branch=? AND t_recorded>=? AND t_recorded<=?
      AND (${dialogueWhere} OR (class='inner' AND kind='wrote' AND ${this.nonempty()})) AND scan_rank_match(content)>0 ORDER BY seq DESC LIMIT 100`)
      .all(this.scope.scene, this.scope.branch, from, to).map(r => Number(r.seq));
  }
  context(limit: number): Event[] {
    return this.decode(this.db.prepare(`SELECT * FROM (
      SELECT * FROM events NOT INDEXED WHERE scene=? AND branch=? AND ${dialogueWhere}
      ORDER BY seq DESC LIMIT ?) ORDER BY seq`).all(this.scope.scene, this.scope.branch, limit));
  }
  usage(): Record<string, unknown>[] {
    const days = new Map<string, Record<string, unknown>>();
    const rows = this.decode(this.db.prepare(`SELECT * FROM events WHERE
      (class='act' AND kind IN ('said','silent')) OR (class='control' AND kind='error')
      OR json_type(meta,'$.usage')='object' ORDER BY seq`).all());
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
      const ending = (event.class === 'act' && ['said', 'silent'].includes(event.kind)) ||
        (event.class === 'control' && event.kind === 'error');
      if (ending) day.turns = Number(day.turns) + 1;
      const usage = event.meta.usage;
      if (usage && typeof usage === 'object' && !Array.isArray(usage)) {
        if (ending) day.turns_with_usage = Number(day.turns_with_usage) + 1;
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
