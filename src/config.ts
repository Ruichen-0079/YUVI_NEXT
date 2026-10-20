import { readFileSync } from 'node:fs';
import type { ModelConfig } from './model.js';
export interface Config extends ModelConfig {
  dataDir: string; persona: string; host: string; port: number; contextEvents: number;
}
export function loadConfig(): Config {
  const required = (name: string) => {
    const value = process.env[name];
    if (!value) throw new Error('Missing required configuration: ' + name);
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
  return { baseUrl, apiKey, model, dataDir, persona,
    host: process.env.YUVI_HOST ?? '127.0.0.1', port: integer('YUVI_PORT', 8787, 65535),
    contextEvents: integer('YUVI_CONTEXT_EVENTS', 200, Number.MAX_SAFE_INTEGER) };
}
