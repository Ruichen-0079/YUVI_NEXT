import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { existsSync, rmSync, statSync, renameSync, openSync, closeSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import { Worker } from 'node:worker_threads';
import type { CheckResult } from './context.js';
import { CURRENT_SCOPE, type Event } from './archive.js';

type Scope = { scene: string; branch: string };
export const TOKENIZER = 'p8-grams-1';
const cjk = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
const word = /[\p{L}\p{N}\p{M}]/u;
export function terms(text: string, query = false): string[] {
  const result: string[] = []; let run: string[] = [], kind = 0;
  const flush = () => {
    if (kind === 1) {
      if (!query || run.length === 1) result.push(...run);
      for (let i = 1; i < run.length; i++) result.push(run[i - 1] + run[i]);
    } else if (kind === 2) result.push(run.join(''));
    run = [];
  };
  for (const char of text.normalize('NFKC').toLowerCase()) {
    const next = cjk.test(char) ? 1 : word.test(char) ? 2 : 0;
    if (next !== kind || !next) { flush(); kind = next; }
    if (next) run.push(char);
  }
  flush(); return query ? [...new Set(result)] : result;
}
const match = (words: string[]) => words.map(t => '"' + t.replaceAll('"', '""') + '"').join(' OR ');
const digest = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 16);
const truncates = (db: DatabaseSync) => (db.prepare("SELECT CAST(x'610062' AS TEXT) v").get()!.v as string).length === 1;
export const eligible = (nul: boolean) => `((class='experience' AND kind='heard') OR (class='act' AND kind IN ('said','silent')) OR (class='inner' AND kind='wrote' AND ${nul ? 'length(content)>0' : "content<>''"}))`;
const decode = (r: Record<string, unknown>): Event => ({ ...r, meta: JSON.parse(r.meta as string) }) as Event;
export interface SearchMeta {
  rules: 'p8'; engine: 'index' | 'scan'; mode: 'relevance' | 'recent' | 'substring';
  terms: string[]; dropped: string[]; fallback?: 'no_terms' | 'index_building' | 'index_unavailable';
  rank_seqs: number[]; terms_limited?: boolean;
}
export interface IndexSearch { results: Event[]; total: number; meta: SearchMeta; }
function boundary(source: DatabaseSync, scope: Scope, nul: boolean, through = Infinity) {
  const params = [scope.scene, scope.branch];
  const last = source.prepare(`SELECT seq,id FROM events NOT INDEXED WHERE scene=? AND branch=? AND ${eligible(nul)} ORDER BY seq DESC LIMIT 1`).get(...params);
  return { first: source.prepare('SELECT id FROM events ORDER BY seq LIMIT 1').get()?.id ?? null,
    last_seq: Number(last?.seq ?? 0), last_id: last?.id ?? null,
    expected: Number(source.prepare(`SELECT count(*) n FROM events NOT INDEXED WHERE scene=? AND branch=? AND seq<=? AND ${eligible(nul)}`).get(...params, through)!.n) };
}
export function supportsFts() {
  const db = new DatabaseSync(':memory:');
  try { db.exec("CREATE VIRTUAL TABLE probe USING fts5(terms,content='',contentless_delete=1)"); return true; }
  catch { return false; } finally { db.close(); }
}
interface Metadata { format: number; tokenizer: string; scene: string; branch: string; decode: string; archive_first_id: string | null; through_seq: number; through_id: string | null; }
function metadata(db: DatabaseSync): Metadata {
  return Object.fromEntries(db.prepare('SELECT key,value FROM metadata').all().map(r => [r.key, JSON.parse(r.value as string)])) as unknown as Metadata;
}
function openWriter(file: string) {
  if (!existsSync(file)) closeSync(openSync(file, 'wx', 0o600));
  else { const mode = statSync(file).mode; if ((mode & 0o222) === 0) throw Error('Index unavailable.'); chmodSync(file, mode & 0o600); }
  return new DatabaseSync(file);
}
function createIndex(db: DatabaseSync, source: DatabaseSync, scope: Scope) {
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;
    CREATE TABLE metadata(key TEXT PRIMARY KEY,value TEXT NOT NULL);
    CREATE TABLE docs(seq INTEGER PRIMARY KEY,kind TEXT NOT NULL,t_recorded INTEGER NOT NULL,chars INTEGER NOT NULL,digest TEXT NOT NULL);
    CREATE INDEX docs_time ON docs(t_recorded);
    CREATE VIRTUAL TABLE terms USING fts5(words,content='',contentless_delete=1,tokenize='ascii');
    CREATE VIRTUAL TABLE vocab USING fts5vocab(terms,'row');`);
  const m: Metadata = { format: 1, tokenizer: TOKENIZER, ...scope, decode: truncates(source) ? 'nul_truncated' : 'full',
    archive_first_id: source.prepare('SELECT id FROM events ORDER BY seq LIMIT 1').get()?.id as string ?? null, through_seq: 0, through_id: null };
  const insert = db.prepare('INSERT INTO metadata VALUES(?,?)');
  for (const [key, value] of Object.entries(m)) insert.run(key, JSON.stringify(value));
}
export function appendBatch(db: DatabaseSync, source: DatabaseSync, scope: Scope, limit = 500): number {
  const m = metadata(db), rows = source.prepare(`SELECT seq,id,kind,t_recorded,content FROM events NOT INDEXED
    WHERE seq>? AND scene=? AND branch=? AND ${eligible(truncates(source))} ORDER BY seq LIMIT ?`).all(m.through_seq, scope.scene, scope.branch, limit);
  if (!rows.length) return 0;
  const doc = db.prepare('INSERT INTO docs VALUES(?,?,?,?,?)'), insert = db.prepare('INSERT INTO terms(rowid,words) VALUES(?,?)');
  db.exec('BEGIN');
  try {
    for (const e of rows) { const content = e.content as string; doc.run(e.seq, e.kind, e.t_recorded, content.length, digest(content)); insert.run(e.seq, terms(content).join(' ')); }
    if (m.archive_first_id === null) m.archive_first_id = source.prepare('SELECT id FROM events ORDER BY seq LIMIT 1').get()!.id as string;
    m.through_seq = Number(rows.at(-1)!.seq); m.through_id = rows.at(-1)!.id as string;
    const update = db.prepare('UPDATE metadata SET value=? WHERE key=?');
    update.run(JSON.stringify(m.archive_first_id), 'archive_first_id');
    update.run(JSON.stringify(m.through_seq), 'through_seq'); update.run(JSON.stringify(m.through_id), 'through_id'); db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  return rows.length;
}
export function buildIndex(directory: string, file = join(directory, 'index.sqlite'), scope: Scope = CURRENT_SCOPE) {
  const source = new DatabaseSync(join(directory, 'archive.sqlite'), { readOnly: true }), db = openWriter(file);
  try { createIndex(db, source, scope); while (appendBatch(db, source, scope)) { /* bounded transactional batches */ }
    db.exec("INSERT INTO terms(terms) VALUES('optimize')");
  } finally { db.close(); source.close(); }
}
export function verifyIndex(source: DatabaseSync, file: string, full = false, scope: Scope = CURRENT_SCOPE) {
  const result: Record<string, unknown> = { status: 'missing' };
  if (!supportsFts()) return { ...result, status: 'unsupported' };
  if (!existsSync(file)) return result;
  let db: DatabaseSync | undefined;
  try {
    db = new DatabaseSync(file, { readOnly: true }); db.exec('BEGIN');
    const m = metadata(db), nul = truncates(source), b = boundary(source, scope, nul, m.through_seq);
    const count = Number(db.prepare('SELECT count(*) n FROM docs').get()!.n);
    Object.assign(result, { through_seq: m.through_seq, last_seq: b.last_seq, rows: count, expected_rows: b.expected, sampled: 0 });
    if (m.format !== 1 || m.tokenizer !== TOKENIZER || m.scene !== scope.scene || m.branch !== scope.branch || m.decode !== (nul ? 'nul_truncated' : 'full')) return { ...result, status: 'version' };
    if (Number(db.prepare('SELECT max(seq) n FROM docs').get()!.n ?? 0) !== m.through_seq || m.archive_first_id !== b.first || (m.through_seq ? source.prepare('SELECT id FROM events WHERE seq=?').get(m.through_seq)?.id !== m.through_id : m.through_id !== null) || count !== b.expected || Number(db.prepare('SELECT count(*) n FROM terms_docsize').get()!.n) !== count) return { ...result, status: 'mismatch' };
    const find = source.prepare('SELECT * FROM events WHERE seq=? AND scene=? AND branch=?'), lookup = db.prepare('SELECT rowid FROM terms WHERE terms MATCH ? AND rowid=?');
    if (full) {
      if (db.prepare('PRAGMA integrity_check').all().some(r => Object.values(r)[0] !== 'ok')) return { ...result, status: 'corrupt' };
      // Walk the posting vocabulary as well as checking each source-row witness.
      db.prepare('SELECT sum(doc),sum(cnt) FROM vocab').get();
    }
    let checked = 0;
    const samples = full ? db.prepare('SELECT * FROM docs ORDER BY seq').iterate() :
      [...new Set(Array.from({ length: Math.min(256, count) }, (_, i) => Number(db!.prepare('SELECT seq FROM docs WHERE seq>=? ORDER BY seq LIMIT 1').get(Math.floor(i * m.through_seq / Math.min(256, count)))?.seq)).filter(Number.isFinite))].map(seq => db!.prepare('SELECT * FROM docs WHERE seq=?').get(seq)!);
    for (const row of samples) {
      const e = find.get(row.seq, scope.scene, scope.branch), words = e ? terms(e.content as string) : [];
      if (!e || e.kind !== row.kind || e.t_recorded !== row.t_recorded || (e.content as string).length !== row.chars || digest(e.content as string) !== row.digest || (words.length && !lookup.get(match([words[0]]), row.seq))) return { ...result, status: 'mismatch', sampled: checked };
      checked++;
    }
    return { ...result, status: m.through_seq < b.last_seq ? 'behind' : 'ok', sampled: checked };
  } catch { return { ...result, status: 'corrupt' }; } finally { db?.close(); }
}

// The archive remains authoritative. Only the service-lock holder constructs this writer.
export class ArchiveIndex {
  private db: DatabaseSync | undefined;
  private worker: Worker | undefined;
  private scanWorker: Worker | undefined;
  private scanId = 0;
  private scans = new Map<number, { resolve: (r: CheckResult) => void; reject: (e: Error) => void }>();
  private state: 'building' | 'ready' | 'unavailable' = 'unavailable';
  private closed = false;
  private warned = false;
  readonly file: string;
  constructor(private source: DatabaseSync, private directory: string, private scope: Scope = CURRENT_SCOPE) {
    this.file = join(directory, 'index.sqlite');
    if (!supportsFts()) { this.fail(); return; }
    const status = verifyIndex(source, this.file, false, scope).status;
    if (status === 'ok' || status === 'behind') { try { this.db = openWriter(this.file); this.state = 'ready'; this.catchUp(); } catch { this.fail(); } }
    else this.rebuild();
  }
  private rebuild() {
    if (this.closed) return;
    try {
      this.db?.close(); this.db = undefined;
      for (const suffix of ['', '-wal', '-shm']) rmSync(this.file + suffix, { force: true });
      this.state = 'building';
      const rows = this.source.prepare(`SELECT seq FROM events NOT INDEXED WHERE scene=? AND branch=? AND ${eligible(truncates(this.source))} LIMIT 2001`).all(this.scope.scene, this.scope.branch);
      if (rows.length <= 2000) { buildIndex(this.directory, this.file, this.scope); this.db = openWriter(this.file); this.state = 'ready'; return; }
      const worker = this.worker = new Worker(new URL('./archive-index-worker.js', import.meta.url), { workerData: { directory: this.directory, scope: this.scope } });
      worker.once('message', () => { if (!this.closed) { try { this.db = openWriter(this.file); this.state = 'ready'; this.catchUp(); } catch (e) { this.fail(e); } } });
      worker.once('error', e => this.fail(e));
      worker.once('exit', code => { if (this.worker === worker) { this.worker = undefined; if (code && !this.closed && this.state !== 'unavailable') this.fail(); } });
    } catch (e) { this.fail(e); }
  }
  private fail(error?: unknown) {
    if (!this.warned) console.error('Archive index unavailable; using literal archive search.');
    this.warned = true;
    try { this.db?.close(); } catch { /* unavailable */ } this.db = undefined;
    const code = (error as { errcode?: number } | undefined)?.errcode;
    this.state = 'unavailable';
    if (code !== undefined && [11, 26].includes(code & 0xff)) this.rebuild();
  }
  catchUp() {
    if (this.state !== 'ready' || !this.db) return;
    try {
      if ((statSync(this.file).mode & 0o222) === 0) throw Error();
      const m = metadata(this.db);
      const lag = this.source.prepare(`SELECT seq FROM events NOT INDEXED WHERE seq>? AND scene=? AND branch=? AND ${eligible(truncates(this.source))} ORDER BY seq LIMIT 2001`).all(m.through_seq, this.scope.scene, this.scope.branch);
      if (lag.length > 2000) { this.rebuild(); return; }
      if (lag.length) appendBatch(this.db, this.source, this.scope, 2000);
    } catch (e) { this.fail(e); }
  }
  search(query: string, from: number, to: number, kinds?: string[]): IndexSearch | { fallback: 'index_building' | 'index_unavailable' } {
    this.catchUp();
    if (!this.db || this.state !== 'ready') return { fallback: this.state === 'building' ? 'index_building' : 'index_unavailable' };
    try {
      const all = terms(query, true), limited = all.length > 32, first = all.slice(0, 32);
      const frequencies = first.map((term, i) => ({ term, i, n: Number(this.db!.prepare('SELECT doc FROM vocab WHERE term=?').get(term)?.doc ?? 0) })).sort((a, b) => a.n - b.n || a.i - b.i);
      let used = frequencies, dropped: string[] = [], sum = 0;
      if (query) {
        used = [];
        for (const f of frequencies) { if (!used.length || sum + f.n <= 50000) { used.push(f); sum += f.n; } else dropped.push(f.term); }
      }
      const common = !!used.length && used[0].n > 50000;
      if (common) { dropped = [...used.slice(1).map(f => f.term), ...dropped]; used = used.slice(0, 1); }
      const words = used.map(f => f.term), relevance = !!query && !common;
      const where = `d.t_recorded>=? AND d.t_recorded<=?${kinds ? ` AND d.kind IN (${kinds.map(() => '?').join(',')})` : ''}`;
      const params = [from, to, ...(kinds ?? [])];
      const table = query ? 'terms f JOIN docs d ON d.seq=f.rowid' : 'docs d';
      const clause = (query ? 'terms MATCH ? AND ' : '') + where;
      const args = [...(query ? [match(words)] : []), ...params];
      const unrestricted = from === -Infinity && to === Infinity && kinds === undefined;
      const total = unrestricted && query ? (used.length === 1 ? used[0].n : Number(this.db.prepare('SELECT count(*) n FROM terms WHERE terms MATCH ?').get(match(words))!.n)) :
        Number(this.db.prepare(`SELECT count(*) n FROM ${table} WHERE ${clause}`).get(...args)!.n);
      const ranked = this.db.prepare(`SELECT d.seq,d.chars FROM ${table} WHERE ${clause} ORDER BY ${query ? (relevance ? 'f.rank,f.rowid DESC' : 'f.rowid DESC') : 'd.seq DESC'} LIMIT 100`).all(...args);
      const picked: number[] = [], lengths = new Map(ranked.map(r => [Number(r.seq), Number(r.chars)])); let chars = 0;
      const add = (seq: number, length: number) => { picked.push(seq); chars += length; };
      if (ranked.length) {
        add(Number(ranked[0].seq), Number(ranked[0].chars));
        if (relevance) {
          const newest = this.db.prepare(`SELECT d.seq,d.chars FROM ${table} WHERE ${clause} ORDER BY f.rowid DESC LIMIT 1`).get(...args)!;
          if (!picked.includes(Number(newest.seq))) add(Number(newest.seq), Number(newest.chars));
        }
        for (const r of ranked) { const seq = Number(r.seq); if (picked.includes(seq)) continue;
          if (picked.length === 40 || chars + Number(r.chars) > 16000) break; add(seq, lengths.get(seq)!); }
      }
      const get = this.source.prepare('SELECT * FROM events WHERE seq=? AND scene=? AND branch=?');
      const results = picked.sort((a, b) => a - b).map(seq => decode(get.get(seq, this.scope.scene, this.scope.branch)!));
      return { results, total, meta: { rules: 'p8', engine: 'index', mode: relevance ? 'relevance' : 'recent', terms: words, dropped,
        rank_seqs: ranked.map(r => Number(r.seq)), ...(limited ? { terms_limited: true } : {}) } };
    } catch (e) { this.fail(e); return { fallback: (this.state as string) === 'unavailable' ? 'index_unavailable' : 'index_building' }; }
  }
  scan(raw: string, owner: string, fallback: NonNullable<SearchMeta['fallback']>): Promise<CheckResult> {
    if (!this.scanWorker) {
      this.scanWorker = new Worker(new URL('./archive-index-worker.js', import.meta.url), { workerData: { mode: 'scan', directory: this.directory, scope: this.scope } });
      this.scanWorker.on('message', ({ id, result, error }) => {
        if (this.closed) return;
        const pending = this.scans.get(id); this.scans.delete(id);
        if (error) pending?.reject(new Error('Archive scan failed.')); else pending?.resolve(result);
      });
      this.scanWorker.on('error', () => { if (!this.closed) for (const p of this.scans.values()) p.reject(new Error('Archive scan failed.')); this.scans.clear(); });
    }
    const id = ++this.scanId, through = Number(this.source.prepare('SELECT max(seq) n FROM events').get()!.n ?? 0);
    return new Promise((resolve, reject) => { this.scans.set(id, { resolve, reject }); this.scanWorker!.postMessage({ id, raw, owner, fallback, through }); });
  }
  async ready() { if (this.worker) await new Promise<void>(resolve => this.worker!.once('exit', () => resolve())); }
  async close() { this.closed = true; this.scans.clear(); this.db?.close(); this.db = undefined; await Promise.all([this.worker?.terminate(), this.scanWorker?.terminate()]); }
}

export function indexCommand(args: string[]) {
  const [command, flag] = args;
  if (!((command === 'verify' && args.length <= 2 && (flag === undefined || flag === '--full')) || (command === 'rebuild' && args.length === 1))) throw Error('Invalid maintenance command or arguments.');
  const directory = process.env.YUVI_DATA_DIR;
  if (!directory?.trim()) throw Error('Missing required configuration: YUVI_DATA_DIR');
  let lock: DatabaseSync | undefined, acquired = false;
  const file = join(directory, 'index.sqlite'), temporary = join(directory, `index.build-${process.pid}.sqlite`);
  // Refuse a running service before touching any index or archive connection.
  try {
    if (command === 'rebuild') { lock = new DatabaseSync(join(directory, 'service.lock')); lock.exec('PRAGMA busy_timeout=0; PRAGMA locking_mode=EXCLUSIVE; BEGIN EXCLUSIVE; COMMIT;'); acquired = true; }
    const source = new DatabaseSync(join(directory, 'archive.sqlite'), { readOnly: true });
    try {
      source.exec('BEGIN');
      if (command === 'verify') return verifyIndex(source, file, flag === '--full');
      buildIndex(directory, temporary);
      const report = verifyIndex(source, temporary, true);
      if (report.status !== 'ok') throw Error();
      for (const suffix of ['-wal', '-shm']) rmSync(file + suffix, { force: true });
      renameSync(temporary, file); return report;
    } finally { source.close(); }
  } finally {
    if (lock) { if (acquired) for (const suffix of ['', '-wal', '-shm']) rmSync(temporary + suffix, { force: true }); lock.close(); }
  }
}
