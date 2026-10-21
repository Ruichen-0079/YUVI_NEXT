import { loadEnvFile } from 'node:process';
import { statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

// Explicit entry point only. Existing environment variables take precedence.
try {
  const file = process.env.YUVI_LOCAL_ENV_FILE ?? join(homedir(), '.config', 'yuvi-next', 'local.env');
  const info = statSync(file);
  if (!info.isFile() || (process.platform !== 'win32' && (info.mode & 0o077) !== 0)) {
    throw new Error('permissions');
  }
  loadEnvFile(file);
} catch {
  console.error('Cannot load local.env; check YUVI_LOCAL_ENV_FILE or the shared local configuration and permissions (0600).');
  process.exit(1);
}
await import('../dist/main.js');
