import { readFileSync } from 'node:fs';
import { snapshotPaths } from './snapshots.js';
import type { ModelConfig } from './model.js';
export interface Config extends ModelConfig {
  dataDir: string; persona: string; host: string; port: number; contextEvents: number;
  idleTimeoutMs: number; maxDurationMs: number;
  snapshotDir?: string; snapshotIntervalMs?: number;
  writingChars?: number; consolidationMaxTokens?: number; consolidationIdleMs?: number; ownerName?: string;
}
export function loadConfig(): Config {
  const required = (name: string) => {
    const value = process.env[name];
    if (!value?.trim()) throw new Error('Missing required configuration: ' + name);
    return value;
  };
  const integer = (name: string, fallback: number, max: number) => {
    const value = Number(process.env[name] ?? fallback);
    if (!Number.isSafeInteger(value) || value < 1 || value > max) throw new Error('Invalid configuration: ' + name);
    return value;
  };
  const baseUrl = required('YUVI_MODEL_BASE_URL');
  try {
    const url = new URL(baseUrl);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error();
  } catch { throw new Error('Invalid configuration: YUVI_MODEL_BASE_URL'); }
  const apiKey = required('YUVI_MODEL_API_KEY');
  const model = required('YUVI_MODEL');
  const dataDir = required('YUVI_DATA_DIR');
  const personaFile = required('YUVI_PERSONA_FILE');
  let persona: string;
  try { persona = readFileSync(personaFile, 'utf8'); }
  catch { throw new Error('Cannot read YUVI_PERSONA_FILE'); }
  const host = process.env.YUVI_HOST ?? '127.0.0.1';
  if (!host.trim()) throw new Error('Invalid configuration: YUVI_HOST');
  const ownerName = process.env.YUVI_OWNER_NAME ?? '负责人';
  if (!ownerName.trim()) throw new Error('Invalid configuration: YUVI_OWNER_NAME');
  return { baseUrl, apiKey, model, dataDir, persona, ownerName,
    writingChars: integer('YUVI_CONTEXT_WRITING_CHARS', 16000, 2_147_483_647),
    consolidationMaxTokens: integer('YUVI_CONSOLIDATION_MAX_TOKENS', 4000, 2_147_483_647),
    consolidationIdleMs: integer('YUVI_CONSOLIDATION_IDLE_MS', 3_600_000, 2_147_483_647),
    snapshotDir: snapshotPaths().snapshotDir,
    snapshotIntervalMs: integer('YUVI_SNAPSHOT_INTERVAL_MS', 86_400_000, 2_147_483_647),
    idleTimeoutMs: integer('YUVI_MODEL_IDLE_TIMEOUT_MS', 60_000, 2_147_483_647),
    maxDurationMs: integer('YUVI_MODEL_MAX_DURATION_MS', 600_000, 2_147_483_647),
    host, port: integer('YUVI_PORT', 8787, 65535),
    contextEvents: integer('YUVI_CONTEXT_EVENTS', 200, Number.MAX_SAFE_INTEGER) };
}

export function configurationMessage(error: unknown): string | undefined {
  const message = error instanceof Error ? error.message : '';
  return /^(Missing required configuration: |Invalid configuration: |Cannot read )YUVI_[A-Z_]+$/.test(message) ? message : undefined;
}
