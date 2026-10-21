import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, chmod, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

test('explicit local startup loads shared env, preserves exported overrides, and does not use cwd .env', async t => {
  const root = await mkdtemp(join(tmpdir(), 'yuvi-local-env-'));
  let authorization;
  const model = createServer(async (req, res) => {
    for await (const chunk of req) { /* consume */ }
    authorization = req.headers.authorization;
    res.end('data: {"choices":[{"delta":{"content":"本地加载成功"}}]}\n\ndata: [DONE]\n\n');
  });
  model.listen(0, '127.0.0.1'); await once(model, 'listening');
  const reserve = createServer(); reserve.listen(0, '127.0.0.1'); await once(reserve, 'listening');
  const port = reserve.address().port; await new Promise(r => reserve.close(r));
  const file = join(root, 'shared.env'), persona = join(root, 'persona.txt');
  await writeFile(persona, '测试人设');
  await writeFile(file, `YUVI_MODEL_BASE_URL=http://127.0.0.1:${model.address().port}/v1\nYUVI_MODEL=fake-local\nYUVI_MODEL_API_KEY=file-fake-key\nYUVI_DATA_DIR=${join(root, 'unused')}\nYUVI_PERSONA_FILE=${persona}\nYUVI_PORT=${port}\nYUVI_HOST=127.0.0.1\n`, { mode: 0o600 });
  const env = { ...process.env, YUVI_LOCAL_ENV_FILE: file, YUVI_MODEL_API_KEY: 'exported-fake-key',
    YUVI_DATA_DIR: join(root, 'actual') };
  for (const name of ['YUVI_MODEL_BASE_URL','YUVI_MODEL','YUVI_PERSONA_FILE','YUVI_PORT','YUVI_HOST','YUVI_SNAPSHOT_DIR']) delete env[name];
  const child = spawn(process.execPath, ['scripts/start-local.mjs'], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = ''; child.stdout.on('data', d => output += d); child.stderr.on('data', d => output += d);
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) { const done = once(child, 'exit'); child.kill('SIGTERM'); await done; }
    const closed = new Promise(r => model.close(r)); model.closeAllConnections(); await closed;
    assert.ok(!output.includes('file-fake-key') && !output.includes('exported-fake-key'));
    await rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
  });
  const url = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let i = 0; i < 200; i++) { try { if ((await fetch(url + '/health')).ok) { ready = true; break; } } catch {} await delay(20); }
  assert.ok(ready, 'local entry point becomes healthy');
  const reply = await (await fetch(url + '/api/messages', { method: 'POST', body: JSON.stringify({ text: '你好' }) })).text();
  assert.match(reply, /本地加载成功/); assert.equal(authorization, 'Bearer exported-fake-key');
  await access(join(root, 'actual', 'archive.sqlite')); await assert.rejects(access(join(root, 'unused')));
});

test('local startup refuses missing or exposed config without logging its values', async t => {
  const root = await mkdtemp(join(tmpdir(), 'yuvi-local-errors-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const file = join(root, 'local.env');
  async function run() {
    const child = spawn(process.execPath, ['scripts/start-local.mjs'], { env: { ...process.env, YUVI_LOCAL_ENV_FILE: file }, stdio: ['ignore','pipe','pipe'] });
    let output = ''; child.stdout.on('data', d => output += d); child.stderr.on('data', d => output += d);
    const [code] = await once(child, 'exit'); assert.notEqual(code, 0); assert.match(output, /Cannot load local.env/);
    assert.ok(!output.includes(root) && !output.includes('fake-sensitive-value'));
  }
  await run();
  if (process.platform !== 'win32') {
    await writeFile(file, 'YUVI_MODEL_API_KEY=fake-sensitive-value'); await chmod(file, 0o644); await run();
  }
});
