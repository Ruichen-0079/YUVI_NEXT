// Usage: node vec.mjs <dir containing node_modules with sqlite-vec>
// Isolated probe: brute-force cosine in JS vs sqlite-vec (vec0) under node:sqlite. Random vectors only.
import { DatabaseSync } from 'node:sqlite';
import { createRequire } from 'node:module';
const require = createRequire(process.argv[2] + '/');
const sqliteVec = require('sqlite-vec');
const D = 512;
let s = 7; const r = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648) - 0.5;
const unit = () => { const v = new Float32Array(D); let n = 0; for (let i = 0; i < D; i++) { v[i] = r(); n += v[i] * v[i]; } n = Math.sqrt(n); for (let i = 0; i < D; i++) v[i] /= n; return v; };
for (const N of [10000, 50000, 200000]) {
  const all = new Float32Array(N * D); for (let i = 0; i < N; i++) all.set(unit(), i * D);
  const q = unit();
  const t = [];
  for (let rep = 0; rep < 7; rep++) {
    const a = performance.now(); const scores = new Float32Array(N);
    for (let i = 0; i < N; i++) { let d = 0; const o = i * D; for (let j = 0; j < D; j++) d += all[o + j] * q[j]; scores[i] = d; }
    let best = -1, bi = -1; for (let i = 0; i < N; i++) if (scores[i] > best) { best = scores[i]; bi = i; }
    t.push(performance.now() - a);
  }
  t.sort((x, y) => x - y);
  const db = new DatabaseSync(':memory:', { allowExtension: true });
  sqliteVec.load(db);
  db.exec(`CREATE VIRTUAL TABLE v USING vec0(embedding float[${D}] distance_metric=cosine)`);
  const ins = db.prepare('INSERT INTO v(rowid, embedding) VALUES (?, ?)');
  db.exec('BEGIN'); for (let i = 0; i < N; i++) ins.run(BigInt(i + 1), new Uint8Array(all.buffer, i * D * 4, D * 4)); db.exec('COMMIT');
  const st = db.prepare('SELECT rowid, distance FROM v WHERE embedding MATCH ? AND k = 8');
  const t2 = [];
  for (let rep = 0; rep < 7; rep++) { const a = performance.now(); st.all(new Uint8Array(q.buffer)); t2.push(performance.now() - a); }
  t2.sort((x, y) => x - y);
  console.log(JSON.stringify({ N, D, js_bruteforce_median_ms: +t[3].toFixed(1), sqlite_vec_flat_median_ms: +t2[3].toFixed(1), vec_version: db.prepare('select vec_version() v').get().v, raw_MB: +(N * D * 4 / 1e6).toFixed(0) }));
  db.close();
}
