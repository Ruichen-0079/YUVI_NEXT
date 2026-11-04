// P8 feasibility probe: 1M synthetic documents, FTS5 contentless + docs side table.
import { DatabaseSync } from 'node:sqlite';
import { rmSync, statSync } from 'node:fs';
const [file, N = '1000000'] = process.argv.slice(2);
const count = Number(N);
for (const s of ['', '-wal', '-shm']) rmSync(file + s, { force: true });
let r = 12345; const rand = () => (r = (Math.imul(r, 1664525) + 1013904223) >>> 0) / 2 ** 32;
// Zipf vocabulary of 3000 Han chars and 400 latin words
const han = []; for (let i = 0; han.length < 3000; i++) han.push(String.fromCodePoint(0x4e00 + ((i * 7919) % 20000)));
const lat = Array.from({ length: 400 }, (_, i) => 'w' + (i * 2654435761 % 1e6).toString(36));
const zipf = n => { const w = Array.from({ length: n }, (_, i) => 1 / (i + 1)); let s = 0; const c = w.map(x => (s += x)); return () => { const u = rand() * s; let lo = 0, hi = n - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (c[m] < u) lo = m + 1; else hi = m; } return lo; }; };
const zh = zipf(han.length), zl = zipf(lat.length);
const sentence = len => { let out = ''; while (out.length < len) out += rand() < 0.08 ? ' ' + lat[zl()] + ' ' : rand() < 0.06 ? '，' : han[zh()]; return out; };
const CJK = '\\p{Script=Han}\\p{Script=Hiragana}\\p{Script=Katakana}\\p{Script=Hangul}';
const RUN = new RegExp(`[${CJK}]+|(?:(?![${CJK}])[\\p{L}\\p{N}])+`, 'gu'), ISCJK = new RegExp(`^[${CJK}]`, 'u');
export function tokens(text) { const out = []; for (const [run] of text.normalize('NFKC').toLowerCase().matchAll(RUN)) { if (ISCJK.test(run)) { const c = [...run]; c.forEach((ch, i) => { out.push(ch); if (i + 1 < c.length) out.push(ch + c[i + 1]); }); } else out.push(run); } return out; }
export function terms(q) { const out = new Set(); for (const [run] of q.normalize('NFKC').toLowerCase().matchAll(RUN)) { if (ISCJK.test(run)) { const c = [...run]; if (c.length === 1) out.add(c[0]); else for (let i = 0; i + 1 < c.length; i++) out.add(c[i] + c[i + 1]); } else out.add(run); } return [...out]; }
const db = new DatabaseSync(file);
db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;
CREATE TABLE docs(seq INTEGER PRIMARY KEY, kind INTEGER NOT NULL, t INTEGER NOT NULL, chars INTEGER NOT NULL);
CREATE INDEX docs_t ON docs(t);
CREATE VIRTUAL TABLE terms USING fts5(x, content='', contentless_delete=1, tokenize='unicode61 remove_diacritics 0');
CREATE VIRTUAL TABLE vocab USING fts5vocab(terms,'row');`);
const insDoc = db.prepare('INSERT INTO docs VALUES (?,?,?,?)'), insT = db.prepare('INSERT INTO terms(rowid,x) VALUES (?,?)');
const t0 = performance.now(); let tokMs = 0, chars = 0, tokCount = 0;
const begin = Date.parse('2026-01-01T00:00:00Z');
const plant = new Map([[150000, '我的猫叫年糕，露川-4A87 是旧密码'], [700000, '更正：我的猫叫团子'], [999000, '昨天说到 amber spruce 的事']]);
db.exec('BEGIN');
for (let seq = 1; seq <= count; seq++) {
  const p = rand(); const kind = seq % 200 === 0 ? 3 : p < 0.48 ? 0 : p < 0.95 ? 1 : 2; // 0 heard 1 said 2 silent 3 wrote
  let text = kind === 3 ? sentence(200 + Math.floor(rand() * 2800)) : kind === 2 ? (rand() < 0.8 ? '' : sentence(8)) : sentence(5 + Math.floor(rand() * (kind ? 300 : 120)));
  if (plant.has(seq)) text += plant.get(seq);
  const a = performance.now(); const tk = tokens(text); tokMs += performance.now() - a;
  chars += text.length; tokCount += tk.length;
  insDoc.run(seq, kind, begin + seq * 7000, text.length);
  if (tk.length) insT.run(seq, tk.join(' '));
  if (seq % 20000 === 0) { db.exec('COMMIT; BEGIN'); }
}
db.exec('COMMIT');
const buildMs = performance.now() - t0;
db.exec("INSERT INTO terms(terms) VALUES('optimize')"); const optMs = performance.now() - t0 - buildMs;
db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
const size = statSync(file).size;
console.log(JSON.stringify({ count, chars, tokCount, buildMs: Math.round(buildMs), tokMs: Math.round(tokMs), optimizeMs: Math.round(optMs), bytes: size }));
const df = db.prepare('SELECT doc FROM vocab WHERE term=?');
function q(label, match, extra = '', params = [], order = 'ORDER BY rank, rowid DESC') {
  const sql = `SELECT rowid FROM terms ${extra} WHERE terms MATCH ? ${params.length ? 'AND ' + params[0] : ''} ${order} LIMIT 40`;
  const st = db.prepare(sql), cs = db.prepare(`SELECT count(*) n FROM terms ${extra} WHERE terms MATCH ? ${params.length ? 'AND ' + params[0] : ''}`);
  const each = []; let ids, n;
  for (let i = 0; i < 7; i++) { const a = performance.now(); ids = st.all(match, ...params.slice(1)); each.push(performance.now() - a); }
  const ce = []; for (let i = 0; i < 3; i++) { const a = performance.now(); n = cs.get(match, ...params.slice(1)).n; ce.push(performance.now() - a); }
  each.sort((x, y) => x - y); ce.sort((x, y) => x - y);
  console.log(JSON.stringify({ label, match: match.slice(0, 60), total: n, med_ms: +each[3].toFixed(2), max_ms: +each[6].toFixed(2), count_med_ms: +ce[1].toFixed(2), top: ids.slice(0, 3).map(x => x.rowid) }));
}
const M = ts => ts.map(t => '"' + t + '"').join(' OR ');
for (const t of ['年糕', '4a87', 'amber', han[0], han[1], han[5], han[50], han[500], han[0] + han[1]]) console.log(JSON.stringify({ term: t, df: df.get(t)?.doc ?? 0 }));
q('rare bigram', M(['年糕']));
q('identifier', M(terms('露川-4A87')));
q('natural q', M(terms('我的猫叫什么来着')));
q('mid char', M([han[50]]));
q('common char', M([han[0]]));
q('two common', M([han[0], han[1]]));
q('5 common OR', M(han.slice(0, 5)));
q('common recency', M([han[0]]), '', [], 'ORDER BY rowid DESC');
q('5 common recency', M(han.slice(0, 5)), '', [], 'ORDER BY rowid DESC');
q('rare + time join', M(['年糕']), 'JOIN docs d ON d.seq=terms.rowid', ['d.t BETWEEN ? AND ?', begin, begin + 400000 * 7000]);
q('common + time join', M([han[0]]), 'JOIN docs d ON d.seq=terms.rowid', ['d.t BETWEEN ? AND ?', begin, begin + 400000 * 7000]);
q('common + rowid range', M([han[0]]), '', ['rowid BETWEEN ? AND ?', 1, 400000]);
q('mid + kind wrote join', M([han[50]]), 'JOIN docs d ON d.seq=terms.rowid', ['d.kind=?', 3]);
q('new fact recency', M(terms('猫叫')));
db.close();
