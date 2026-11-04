import { loadConfig, configurationMessage } from './config.js';
import { createApp } from './server.js';
import { Archive, ArchiveIntegrityError, DataDirectoryInUseError } from './archive.js';
import { prepareSnapshotDirectory, snapshotPaths } from './snapshots.js';
import { startAutomaticSnapshots } from './automatic-snapshots.js';
process.umask(0o077);
try {
  const config = loadConfig();
  let archive;
  try { archive = new Archive(config.dataDir); }
  catch (error) {
    console.error((error instanceof DataDirectoryInUseError || error instanceof ArchiveIntegrityError) ? error.message : 'Cannot open YUVI_DATA_DIR database.');
    process.exit(1);
  }
  const paths = snapshotPaths();
  try { prepareSnapshotDirectory(paths); }
  catch { archive.close(); console.error('Cannot use YUVI_SNAPSHOT_DIR; check directory configuration and permissions.'); process.exit(1); }
  let app;
  try { app = createApp(config, archive); }
  catch { archive.close(); console.error('Cannot initialize YUVI_DATA_DIR.'); process.exit(1); }
  const { server } = app;
  server.on('error', async () => {
    await app.index.close().catch(() => {}); app.archive.close();
    console.error('Cannot listen; check YUVI_HOST and YUVI_PORT.'); process.exitCode = 1;
  });
  server.listen(config.port, config.host, () => {
    const stopSnapshots = startAutomaticSnapshots(paths, config.snapshotIntervalMs!);
    server.once('close', stopSnapshots);
    for (const signal of ['SIGTERM', 'SIGINT'] as const) process.once(signal, async () => {
      stopSnapshots(); await app.index.close(); archive.close(); process.exit(0);
    });
    console.log('YUVI is ready.');
  });
} catch (error) {
  console.error(configurationMessage(error) ?? 'Startup failed; check configuration and data directory.');
  process.exitCode = 1;
}
