import { DatabaseSync } from 'node:sqlite';
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, realpathSync, existsSync, statSync, lstatSync, readdirSync, chmodSync,
  openSync, closeSync, fsyncSync, unlinkSync, writeFileSync, readFileSync, mkdtempSync,
  linkSync, renameSync, rmSync } from 'node:fs';
import { join, resolve, dirname, basename } from 'node:path';
import { checkArchive, checkArchiveFile } from './schema.js';

export interface SnapshotPaths { dataDir: string; snapshotDir: string; }
export function snapshotPaths(env = process.env): SnapshotPaths {
  if (!env.YUVI_DATA_DIR?.trim()) throw new Error('Missing required configuration: YUVI_DATA_DIR');
  const dataDir = resolve(env.YUVI_DATA_DIR);
  const snapshotDir = env.YUVI_SNAPSHOT_DIR ?? join(dataDir, 'snapshots');
  if (!snapshotDir.trim()) throw new Error('Invalid configuration: YUVI_SNAPSHOT_DIR');
  return { dataDir, snapshotDir: resolve(snapshotDir) };
}
function canonical(path: string): string {
  if (existsSync(path)) return realpathSync(path);
  return join(canonical(dirname(path)), basename(path));
}
function syncFile(path: string): void {
  const fd = openSync(path, 'r'); try { fsyncSync(fd); } finally { closeSync(fd); }
}
export function prepareSnapshotDirectory(paths: SnapshotPaths): void {
  try {
    if (canonical(paths.dataDir) === canonical(paths.snapshotDir)) throw new Error();
    mkdirSync(paths.snapshotDir, { recursive: true, mode: 0o700 });
    if (!statSync(paths.snapshotDir).isDirectory()) throw new Error();
    chmodSync(paths.snapshotDir, 0o700);
    const probe = join(paths.snapshotDir, '.probe-' + randomUUID());
    const fd = openSync(probe, 'wx', 0o600);
    try { fsyncSync(fd); } finally { closeSync(fd); unlinkSync(probe); }
  } catch { throw new Error('Cannot use YUVI_SNAPSHOT_DIR; check directory configuration and permissions.'); }
}
export function sha256(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}
function stats(db: DatabaseSync) {
  const row = db.prepare('SELECT id,seq,branch FROM events ORDER BY seq DESC LIMIT 1').get();
  return { events: Number(db.prepare('SELECT count(*) AS n FROM events').get()!.n),
    max_seq: Number(row?.seq ?? 0), max_id: String(row?.id ?? 'unknown'), branch: String(row?.branch ?? 'unknown') };
}
export interface VerifiedSnapshot {
  events: number; max_seq: number; max_id: string; branch: string; sha256: string; created_at: string;
}
export function verifySnapshot(file: string): VerifiedSnapshot {
  let manifest: Record<string, unknown>;
  try { manifest = JSON.parse(readFileSync(file + '.json', 'utf8')); }
  catch { throw new Error('Snapshot verification failed: missing or invalid manifest.'); }
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest) || manifest.version !== 1 || typeof manifest.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(manifest.sha256) ||
    typeof manifest.created_at !== 'string' || !Number.isFinite(Date.parse(manifest.created_at))) {
    throw new Error('Snapshot verification failed: invalid manifest.');
  }
  let digest: string;
  try {
    if (!statSync(file).isFile() || ['-wal', '-shm', '-journal'].some(s => existsSync(file + s))) throw new Error();
    digest = sha256(file);
  } catch { throw new Error('Snapshot verification failed: missing or non-standalone database.'); }
  if (digest !== manifest.sha256) throw new Error('Snapshot verification failed: SHA-256 mismatch.');
  let db: DatabaseSync | undefined;
  try {
    db = new DatabaseSync(file, { readOnly: true }); checkArchive(db);
    const info = stats(db);
    for (const key of ['events', 'max_seq', 'max_id', 'branch'] as const) {
      if (info[key] !== manifest[key]) throw new Error('Snapshot metadata mismatch.');
    }
    return { ...info, sha256: digest, created_at: manifest.created_at };
  } catch (error) {
    if (error instanceof Error && ['SQLite integrity check failed.', 'Archive schema or append-only triggers mismatch.',
      'Snapshot metadata mismatch.'].includes(error.message)) throw new Error('Snapshot verification failed: ' + error.message);
    throw new Error('Snapshot verification failed: invalid SQLite archive.');
  } finally { db?.close(); }
}
export function createSnapshot(paths: SnapshotPaths): string {
  prepareSnapshotDirectory(paths);
  const stage = mkdtempSync(join(paths.snapshotDir, '.building-')); chmodSync(stage, 0o700);
  const temp = join(stage, 'archive.sqlite');
  try {
    writeFileSync(temp, '', { flag: 'wx', mode: 0o600 });
    const source = new DatabaseSync(join(paths.dataDir, 'archive.sqlite'), { readOnly: true });
    try { checkArchive(source); source.prepare('VACUUM INTO ?').run(temp); } finally { source.close(); }
    chmodSync(temp, 0o600);
    const copy = new DatabaseSync(temp);
    let info: ReturnType<typeof stats>;
    try { copy.exec('PRAGMA journal_mode=DELETE;'); checkArchive(copy); info = stats(copy); } finally { copy.close(); }
    const now = new Date();
    const name = now.toISOString().replace(/:/g, '-') + '-' + randomUUID() + '.sqlite';
    const file = join(paths.snapshotDir, name);
    const manifest = { version: 1, created_at: now.toISOString(), sha256: sha256(temp), ...info };
    writeFileSync(temp + '.json', JSON.stringify(manifest) + '\n', { flag: 'wx', mode: 0o600 });
    syncFile(temp); syncFile(temp + '.json'); syncFile(stage);
    // No-clobber atomic links publish only closed, fully synced files. The manifest
    // is the commit marker: an orphan database without it never verifies.
    linkSync(temp, file); syncFile(paths.snapshotDir);
    linkSync(temp + '.json', file + '.json'); syncFile(paths.snapshotDir);
    return file;
  } finally { rmSync(stage, { recursive: true, force: true }); }
}
export function snapshotIfDue(paths: SnapshotPaths, interval: number): number {
  prepareSnapshotDirectory(paths);
  const files = readdirSync(paths.snapshotDir).filter(n => n.endsWith('.sqlite')).sort().reverse();
  for (const name of files) {
    try {
      const recent = verifySnapshot(join(paths.snapshotDir, name));
      if (Date.now() - Date.parse(recent.created_at) < interval) return Date.parse(recent.created_at);
      break;
    } catch { /* Uncommitted or damaged files never postpone a new snapshot. */ }
  }
  const file = createSnapshot(paths);
  return Date.parse(JSON.parse(readFileSync(file + '.json', 'utf8')).created_at);
}
export function restoreSnapshot(file: string, target: string): void {
  const verified = verifySnapshot(file);
  target = resolve(target);
  const acceptable = () => !existsSync(target) || (lstatSync(target).isDirectory() && readdirSync(target).length === 0);
  if (!acceptable()) throw new Error('Restore refused: target must be a new or empty directory.');
  // The parent must already exist; never change another data directory to build it.
  const stage = mkdtempSync(join(dirname(target), '.yuvi-restore-')); chmodSync(stage, 0o700);
  try {
    const copy = join(stage, 'archive.sqlite');
    writeFileSync(copy, readFileSync(file), { flag: 'wx', mode: 0o600 });
    if (sha256(copy) !== verified.sha256) throw new Error('Restore refused: snapshot changed during copying.');
    checkArchiveFile(copy);
    const db = new DatabaseSync(copy);
    try {
      db.exec('PRAGMA journal_mode=DELETE; PRAGMA synchronous=FULL;');
      db.prepare(`INSERT INTO events (id,branch,class,kind,scene,actor,t_recorded,reply_to,content,model,meta)
        VALUES (?,?,'control','restored','unknown','system',?,NULL,'',NULL,?)`).run(
        randomUUID(), verified.branch, Date.now(), JSON.stringify({ through_seq: verified.max_seq,
          through_id: verified.max_id, snapshot_sha256: verified.sha256 }));
    } finally { db.close(); }
    syncFile(copy); syncFile(stage);
    if (!acceptable()) throw new Error('Restore refused: target is no longer empty.');
    // On Linux rename cannot replace a nonempty directory or a symlink with this
    // directory; a concurrent service creating service.lock also prevents publish.
    renameSync(stage, target); syncFile(dirname(target));
  } finally { rmSync(stage, { recursive: true, force: true }); }
}
