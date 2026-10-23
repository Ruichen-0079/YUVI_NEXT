import { parentPort, workerData } from 'node:worker_threads';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { buildIndex } from './archive-index.js';
import { scanArchive } from './archive.js';
import { check } from './context.js';
if (workerData.mode === 'scan') {
  const db = new DatabaseSync(join(workerData.directory, 'archive.sqlite'), { readOnly: true });
  parentPort!.on('message', async ({ id, raw, owner, fallback, through }) => {
    try {
      db.exec('BEGIN');
      const result = await check({
        search: (q, from, to) => scanArchive(db, workerData.scope, q, from, to, through) as { results: import('./archive.js').Event[]; total: number },
        scanRanks: (q, from, to) => scanArchive(db, workerData.scope, q, from, to, through, true) as number[]
      }, raw, owner, { engine: 'scan', fallback });
      db.exec('ROLLBACK'); parentPort!.postMessage({ id, result });
    } catch { try { db.exec('ROLLBACK'); } catch { /* connection failed */ } parentPort!.postMessage({ id, error: true }); }
  });
} else {
  buildIndex(workerData.directory, undefined, workerData.scope);
  parentPort!.postMessage('ready');
}
