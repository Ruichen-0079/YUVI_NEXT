import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Archive } from '../../dist/archive.js';

export function insertEvents(db, events) {
  const insert = db.prepare(`INSERT INTO events
    (seq,id,branch,class,kind,scene,actor,t_recorded,reply_to,content,model,meta) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
  db.exec('BEGIN');
  try {
    for (const input of events) {
      const e = { id: 'fixture-' + input.seq, branch: 'dev:v2-dev', scene: 'web', actor: 'yuvi',
        t_recorded: 1760000000000 + input.seq, reply_to: null, content: '', model: null, meta: {}, ...input };
      insert.run(e.seq,e.id,e.branch,e.class,e.kind,e.scene,e.actor,e.t_recorded,e.reply_to,e.content,e.model,JSON.stringify(e.meta));
    }
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}
export function withArchive(events, fn) {
  const directory = mkdtempSync(join(tmpdir(), 'yuvi-fixture-'));
  let archive = new Archive(directory);
  try {
    insertEvents(archive.db, events); archive.close(); archive = new Archive(directory);
    return fn(archive);
  } finally { archive.close(); rmSync(directory, { recursive: true, force: true }); }
}
