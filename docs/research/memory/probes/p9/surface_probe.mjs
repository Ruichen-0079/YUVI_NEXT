// P9 planning probe: per-turn surfacing cost on the 1M varied P8 index, cue = a real heard message.
import { DatabaseSync } from 'node:sqlite';
import { terms } from '../../../../../dist/archive-index.js';
const [indexFile, archiveFile] = process.argv.slice(2);
const db = new DatabaseSync(indexFile, { readOnly: true }), a = new DatabaseSync(archiveFile, { readOnly: true });
const cues = a.prepare("SELECT content FROM events WHERE kind='heard' AND seq % 33331 = 7 LIMIT 30").all().map(r => r.content);
const df = db.prepare('SELECT doc FROM vocab WHERE term=?');
const out = [];
for (const cue of cues) {
  const all = terms(cue, true).slice(0, 32);
  const f = all.map((t, i) => ({ t, i, n: Number(df.get(t)?.doc ?? 0) })).sort((x, y) => x.n - y.n || x.i - y.i);
  const used = []; let sum = 0; for (const x of f) { if (!used.length || sum + x.n <= 50000) { used.push(x); sum += x.n; } }
  const common = used.length && used[0].n > 50000;
  if (common) { out.push({ cue_chars: cue.length, terms: all.length, used: 0, mode: 'common_skip', ms: 0 }); continue; }
  const match = used.map(x => '"' + x.t + '"').join(' OR ');
  const st = db.prepare("SELECT f.rowid FROM terms f JOIN docs d ON d.seq=f.rowid WHERE terms MATCH ? AND d.kind='wrote' ORDER BY f.rank, f.rowid DESC LIMIT 20");
  const times = []; let rows;
  for (let i = 0; i < 6; i++) { const t0 = performance.now(); rows = st.all(match); times.push(performance.now() - t0); }
  times.sort((x, y) => x - y);
  out.push({ cue_chars: cue.length, terms: all.length, used: used.length, candidates_df_sum: sum, wrote_hits: rows.length, ms_median: +times[3].toFixed(2), ms_max: +times[5].toFixed(2) });
}
const ms = out.filter(o => o.ms_median !== undefined).map(o => o.ms_median).sort((x, y) => x - y);
console.log(JSON.stringify({ cues: out.length, common_skipped: out.filter(o => o.mode).length, p50: ms[Math.floor(ms.length / 2)], p95: ms[Math.ceil(ms.length * 0.95) - 1], max: ms.at(-1), sample: out.slice(0, 5) }, null, 1));
