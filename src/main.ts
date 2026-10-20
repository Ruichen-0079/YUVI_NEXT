import { loadConfig, configurationMessage } from './config.js';
import { createApp } from './server.js';
try {
  const config = loadConfig();
  let app;
  try { app = createApp(config); }
  catch { console.error('Cannot open YUVI_DATA_DIR database.'); process.exit(1); }
  const { server } = app;
  server.on('error', () => {
    console.error('Cannot listen; check YUVI_HOST and YUVI_PORT.'); process.exitCode = 1;
  });
  server.listen(config.port, config.host, () => console.log('YUVI is ready.'));
} catch (error) {
  console.error(configurationMessage(error) ?? 'Startup failed; check configuration and data directory.');
  process.exitCode = 1;
}
