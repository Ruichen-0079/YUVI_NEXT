import { parentPort, workerData } from 'node:worker_threads';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { buildIndex } from './archive-index.js';
import { scanArchive } from './archive.js';
import { check } from './context.js';
if (workerData.mode === 'scan') {
  const db = new DatabaseSync(join(workerData.directory, 'archive.sqlite'), { readOnly: true });
  parentPort!.on('message', async ({ id, raw, owner, fallback, through, tool }) => {
    try {
      db.exec('BEGIN');
      const options = tool === 'recall' ? { kinds: ['wrote'], limit: 10, chars: 8000 } : undefined;
      const result = await check({
        search: (q, from, to) => scanArchive(db, workerData.scope, q, from, to, through, false, options) as { results: import('./archive.js').Event[]; total: number },
        scanRanks: (q, from, to) => scanArchive(db, workerData.scope, q, from, to, through, true, options) as number[]
      }, raw, owner, { engine: 'scan', fallback, ...(tool === 'recall' ? { tool: 'recall' as const } : {}) });
      db.exec('ROLLBACK'); parentPort!.postMessage({ id, result });
    } catch { try { db.exec('ROLLBACK'); } catch { /* connection failed */ } parentPort!.postMessage({ id, error: true }); }
  });
} else {
  buildIndex(workerData.directory, undefined, workerData.scope);
  parentPort!.postMessage('ready');
}
