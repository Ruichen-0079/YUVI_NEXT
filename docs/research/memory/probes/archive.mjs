// Isolated probe: 1M synthetic events with the P4 archive schema; per-turn queries with/without an extra index.
// Usage: npm run build && node archive.mjs <YUVI_NEXT checkout> <scratch sqlite path>
import { DatabaseSync } from 'node:sqlite';
import { rmSync, statSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const { ARCHIVE_SCHEMA } = await import(pathToFileURL(process.argv[2] + '/dist/schema.js'));
const file = process.argv[3]; rmSync(file, { force: true });
const db = new DatabaseSync(file);
db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;'); db.exec(ARCHIVE_SCHEMA);
const ins = db.prepare(`INSERT INTO events (id,branch,class,kind,scene,actor,t_recorded,reply_to,content,model,meta) VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
const N = 1_000_000; let t = Date.parse('2024-01-01'); let a0 = performance.now();
db.exec('BEGIN');
for (let i = 1; i <= N; i++) {
  t += 30000; const k = i % 4;
  if (i % 400 === 0) ins.run('e' + i, 'dev:v2-dev', 'inner', 'wrote', 'web', 'yuvi', t, null, '写下的文字'.repeat(40), 'm', JSON.stringify({ material: { from_seq: i - 399, through_seq: i - 1 } }));
  else if (k === 0) ins.run('e' + i, 'dev:v2-dev', 'experience', 'heard', 'web', 'owner', t, null, '今天天气不错我们去散步'.repeat(3), null, '{}');
  else if (k === 1) ins.run('e' + i, 'dev:v2-dev', 'act', 'reply_attempt', 'web', 'yuvi', t, null, '', 'm', '{}');
  else ins.run('e' + i, 'dev:v2-dev', 'act', 'said', 'web', 'yuvi', t, null, '好的，我记得'.repeat(5), 'm', '{"usage":{"prompt_tokens":1000}}');
}
db.exec('COMMIT');
const build = performance.now() - a0;
const qs = {
  full_decode: () => db.prepare('SELECT * FROM events ORDER BY seq').all().map(r => ({ ...r, meta: JSON.parse(r.meta) })).length,
  last_200_dialogue: () => db.prepare(`SELECT * FROM events WHERE scene='web' AND branch='dev:v2-dev' AND ((class='experience' AND kind='heard') OR (class='act' AND kind IN ('said','silent'))) ORDER BY seq DESC LIMIT 200`).all().length,
  covered: () => db.prepare(`SELECT max(json_extract(meta,'$.material.through_seq')) c FROM events WHERE class='inner' AND kind='wrote'`).get().c,
  writings_budget: () => db.prepare(`SELECT seq,length(content) l FROM events WHERE class='inner' AND kind='wrote' AND content<>'' ORDER BY seq DESC LIMIT 100`).all().length,
  covered_latest: () => db.prepare(`SELECT meta FROM events WHERE (class='inner' AND kind='wrote') OR (class='control' AND kind='unconsolidated') ORDER BY seq DESC LIMIT 1`).get(),
  check_rare_full_scan: () => db.prepare(`SELECT seq FROM events WHERE class IN ('experience','act','inner') AND instr(content, ?) > 0 ORDER BY seq DESC LIMIT 40`).all('青梧书屋').length,
  usage_full: () => db.prepare(`SELECT count(*) FROM events WHERE json_type(meta,'$.usage')='object'`).get(),
  check_like: () => db.prepare(`SELECT seq FROM events WHERE class IN ('experience','act','inner') AND instr(content, ?) > 0 ORDER BY seq DESC LIMIT 40`).all('散步').length,
};
const run = label => { const out = {}; for (const [k, f] of Object.entries(qs)) { if (k === 'full_decode' && label !== 'no_index') continue; const ts = []; for (let r = 0; r < 5; r++) { const a = performance.now(); f(); ts.push(performance.now() - a); } ts.sort((x, y) => x - y); out[k] = +ts[2].toFixed(1); } return out; };
const before = run('no_index');
db.exec(`CREATE INDEX probe_kind ON events(class, kind, seq)`);
const after = run('with_index');
console.log(JSON.stringify({ N, build_s: +(build / 1000).toFixed(1), size_MB: +(statSync(file).size / 1e6).toFixed(0), median_ms_no_index: before, median_ms_with_class_kind_seq_index: after }, null, 1));
