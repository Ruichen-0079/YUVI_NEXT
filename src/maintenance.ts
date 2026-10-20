import { createSnapshot, verifySnapshot, restoreSnapshot, snapshotIfDue, snapshotPaths } from './snapshots.js';
try {
  const [command, ...args] = process.argv.slice(2);
  if (command === 'snapshot' && args.length === 0) console.log(createSnapshot(snapshotPaths()));
  else if (command === 'verify-snapshot' && args.length === 1) {
    const info = verifySnapshot(args[0]);
    console.log(JSON.stringify({ events: info.events, max_seq: info.max_seq }));
  } else if (command === 'restore' && args.length === 2) {
    restoreSnapshot(args[0], args[1]); console.log('Restore completed.');
  } else if (command === 'auto' && args.length === 0) {
    const interval = Number(process.env.YUVI_SNAPSHOT_INTERVAL_MS ?? 86400000);
    if (!Number.isSafeInteger(interval) || interval <= 0 || interval > 2147483647) throw new Error('Invalid configuration: YUVI_SNAPSHOT_INTERVAL_MS');
    console.log(snapshotIfDue(snapshotPaths(), interval));
  } else throw new Error('Invalid maintenance command or arguments.');
} catch (error) {
  const message = error instanceof Error ? error.message : '';
  // Only fixed application diagnostics, never filesystem/provider exception text.
  const safe = /^(Snapshot verification failed: |Restore refused: |Missing required configuration: YUVI_|Invalid configuration: YUVI_)/.test(message) ||
    message === 'Cannot use YUVI_SNAPSHOT_DIR; check directory configuration and permissions.' ||
    message === 'Invalid maintenance command or arguments.';
  console.error(safe ? message : 'Archive maintenance failed; check YUVI_DATA_DIR, YUVI_SNAPSHOT_DIR and file permissions.');
  process.exitCode = 1;
}
