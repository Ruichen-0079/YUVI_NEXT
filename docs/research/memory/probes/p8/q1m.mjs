import { DatabaseSync } from 'node:sqlite';
const db = new DatabaseSync(process.argv[2]);
const begin = Date.parse('2026-01-01T00:00:00Z');
const han = []; for (let i = 0; han.length < 3000; i++) han.push(String.fromCodePoint(0x4e00 + ((i * 7919) % 20000)));
const M = ts => ts.map(t => '"' + t + '"').join(' OR ');
function run(label, sql, params) {
  const st = db.prepare(sql); const each = []; let out;
  for (let i = 0; i < 7; i++) { const a = performance.now(); out = st.all(...params); each.push(performance.now() - a); }
  each.sort((x, y) => x - y); console.log(JSON.stringify({ label, rows: out.length, med_ms: +each[3].toFixed(2), max_ms: +each[6].toFixed(2), first: out[0] }));
}
const lo = begin, hi = begin + 400000 * 7000;
// time range -> seq bounds (superset), then rowid range inside FTS, exact t filter via join
const bounds = 'SELECT min(seq) a, max(seq) b FROM docs WHERE t BETWEEN ? AND ?';
run('bounds lookup', bounds, [lo, hi]);
const { a, b } = db.prepare(bounds).get(lo, hi);
for (const [label, term] of [['rare', '年糕'], ['mid', han[500]], ['common', han[0]]]) {
  run(`${label} rank, rowid-range + t join`, `SELECT f.rowid s FROM terms f JOIN docs d ON d.seq=f.rowid WHERE terms MATCH ? AND f.rowid BETWEEN ? AND ? AND d.t BETWEEN ? AND ? ORDER BY f.rank, f.rowid DESC LIMIT 40`, [M([term]), a, b, lo, hi]);
  run(`${label} count, rowid-range + t join`, `SELECT count(*) n FROM terms f JOIN docs d ON d.seq=f.rowid WHERE terms MATCH ? AND f.rowid BETWEEN ? AND ? AND d.t BETWEEN ? AND ?`, [M([term]), a, b, lo, hi]);
  run(`${label} rank only wrote (kind join)`, `SELECT f.rowid s FROM terms f JOIN docs d ON d.seq=f.rowid WHERE terms MATCH ? AND d.kind=3 ORDER BY f.rank, f.rowid DESC LIMIT 40`, [M([term])]);
  run(`${label} recency, rowid-range`, `SELECT f.rowid s FROM terms f WHERE terms MATCH ? AND f.rowid BETWEEN ? AND ? ORDER BY f.rowid DESC LIMIT 40`, [M([term]), a, b]);
}
run('empty query recency in range', 'SELECT seq FROM docs WHERE t BETWEEN ? AND ? ORDER BY seq DESC LIMIT 40', [lo, hi]);
run('vocab df lookup x7', `SELECT term, doc FROM vocab WHERE term IN (${Array(7).fill('?').join(',')})`, ['我的','的猫','猫叫','叫什','什么','么来','来着']);
run('docs count', 'SELECT count(*) n FROM docs', []);
