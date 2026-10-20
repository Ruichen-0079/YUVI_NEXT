import { spawn, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import type { SnapshotPaths } from './snapshots.js';
export function startAutomaticSnapshots(paths: SnapshotPaths, interval: number): () => void {
  let running: ChildProcess | undefined, stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const check = () => {
    if (stopped) return;
    // No model credentials are passed to the maintenance worker.
    const child = running = spawn(process.execPath, [fileURLToPath(new URL('./maintenance.js', import.meta.url)), 'auto'], {
      env: { YUVI_DATA_DIR: paths.dataDir, YUVI_SNAPSHOT_DIR: paths.snapshotDir, YUVI_SNAPSHOT_INTERVAL_MS: String(interval) },
      stdio: ['ignore', 'pipe', 'ignore']
    });
    let output = '', failed = false;
    child.stdout!.on('data', data => { output += data; });
    child.on('error', () => { failed = true; });
    child.on('close', code => {
      running = undefined;
      if (stopped) return;
      const created = Number(output.trim());
      failed ||= code !== 0 || !Number.isFinite(created) || created <= 0;
      if (failed) console.error('Automatic snapshot failed; will retry.');
      const delay = failed ? Math.min(interval, 1000) : Math.max(1, created + interval - Date.now());
      timer = setTimeout(check, delay); timer.unref();
    });
  };
  check();
  return () => { stopped = true; clearTimeout(timer); running?.kill('SIGTERM'); };
}
