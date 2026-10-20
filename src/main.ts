import { loadConfig } from './config.js';
import { createApp } from './server.js';
try {
  const config = loadConfig();
  const { server } = createApp(config);
  server.on('error', () => {
    console.error('Server failed to listen.'); process.exitCode = 1;
  });
  server.listen(config.port, config.host, () => console.log('YUVI is ready.'));
} catch {
  console.error('Startup failed; check configuration and data directory.');
  process.exitCode = 1;
}
