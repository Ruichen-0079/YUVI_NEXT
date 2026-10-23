import { DatabaseSync } from 'node:sqlite';
const db = new DatabaseSync(process.argv[2]); db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;');
const insD = db.prepare('INSERT INTO docs VALUES (?,?,?,?)'), insT = db.prepare('INSERT INTO terms(rowid,x) VALUES (?,?)'), meta = db.prepare('SELECT max(seq) m FROM docs');
let seq = meta.get().m; const each = [];
const text = '今天 和 朋友 去 公园 散步 看到 一只 猫 年糕 wechat 2026'.split(' ');
for (let i = 0; i < 2000; i++) {
  const a = performance.now();
  db.exec('BEGIN'); for (let k = 0; k < 4; k++) { seq++; insD.run(seq, 1, Date.now(), 40); insT.run(seq, text.join(' ')); } db.exec('COMMIT');
  each.push(performance.now() - a);
}
each.sort((x, y) => x - y);
console.log(JSON.stringify({ batches: each.length, events_per_batch: 4, p50: +each[1000].toFixed(3), p95: +each[1900].toFixed(3), p99: +each[1980].toFixed(3), max: +each.at(-1).toFixed(2) }));
