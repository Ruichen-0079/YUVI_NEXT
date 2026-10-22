import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, writeFile, readFile, readdir, rm, mkdir, stat, copyFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { createHash } from 'node:crypto';
import { Archive } from '../dist/archive.js';
import { verifySnapshot } from '../dist/snapshots.js';

const secret = 'p3-unique-test-secret-592e';
const delta = text => `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`;
const hash = data => createHash('sha256').update(data).digest('hex');
async function filesTree(path, prefix = '') {
  const result = {};
  for (const item of await readdir(path, { withFileTypes: true }).catch(() => [])) {
    const rel = prefix + item.name;
    if (item.isDirectory()) Object.assign(result, await filesTree(join(path, item.name), rel + '/'));
    else result[rel] = hash(await readFile(join(path, item.name)));
  }
  return result;
}
async function waitFor(check, timeout = 10000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) { const value = await check(); if (value) return value; await delay(20); }
  throw Error('condition timed out');
}
// npm test already compiled dist. Rebuilding it during parallel process tests
// can expose partially written ES modules; still exercise the npm maintenance entry.
function cli(command, args = [], env = {}, npm = false) {
  const child = spawn(npm ? 'npm' : process.execPath,
    npm ? ['--ignore-scripts', 'run', command, '--', ...args] : ['dist/maintenance.js', command, ...args],
    { env: { ...process.env, YUVI_MODEL_BASE_URL: '', YUVI_MODEL_API_KEY: '', YUVI_PERSONA_FILE: '', YUVI_MODEL: '', ...env }, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
  let stdout = '', stderr = '';
  child.stdout.on('data', data => { stdout += data; }); child.stderr.on('data', data => { stderr += data; });
  const done = once(child, 'exit').then(([code, signal]) => {
    assert.ok(!stdout.includes(secret) && !stderr.includes(secret));
    return { code, signal, stdout, stderr };
  });
  return { child, done };
}
async function command(command, args, env, npm = false) {
  const result = await cli(command, args, env, npm).done;
  return result;
}
async function listen(server) {
  server.listen(0, '127.0.0.1'); await once(server, 'listening'); return `http://127.0.0.1:${server.address().port}`;
}
function rows(file) {
  const db = new DatabaseSync(file, { readOnly: true });
  try { return db.prepare('SELECT * FROM events ORDER BY seq').all().map(e => ({ ...e, meta: JSON.parse(e.meta) })); }
  finally { db.close(); }
}
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'yuvi-p3-'));
  const data = join(root, 'data'); await mkdir(data, { mode: 0o700 });
  const persona = join(root, 'persona.txt'); await writeFile(persona, 'P3 independent test persona\n');
  const handlers = [], requests = [], children = [];
  const model = createServer(async (req, res) => {
    let body = ''; for await (const chunk of req) body += chunk;
    requests.push(JSON.parse(body));
    const handler = handlers.shift() ?? (res => res.end(delta('正常回复') + 'data: [DONE]\n\n'));
    try { await handler(res); } catch { res.destroy(); }
  });
  const base = await listen(model);
  const env = { YUVI_DATA_DIR: data, YUVI_PERSONA_FILE: persona, YUVI_MODEL_BASE_URL: base + '/v1',
    YUVI_MODEL: 'fake-p3', YUVI_MODEL_API_KEY: secret, YUVI_HOST: '127.0.0.1',
    YUVI_MODEL_IDLE_TIMEOUT_MS: '60000', YUVI_MODEL_MAX_DURATION_MS: '600000', YUVI_SNAPSHOT_INTERVAL_MS: '86400000' };
  async function spawnService(overrides = {}) {
    const port = createServer(), url = await listen(port); await new Promise(r => port.close(r));
    const child = spawn(process.execPath, ['dist/main.js'], { env: { ...process.env, ...env, YUVI_PORT: new URL(url).port, ...overrides }, stdio: ['ignore', 'pipe', 'pipe'] });
    const instance = { child, url, stdout: '', stderr: '', exited: false, code: undefined };
    child.stdout.on('data', d => instance.stdout += d); child.stderr.on('data', d => instance.stderr += d);
    instance.exit = once(child, 'exit').then(([code]) => { instance.code = code; instance.exited = true; });
    children.push(instance); return instance;
  }
  async function start(overrides) {
    const service = await spawnService(overrides);
    await waitFor(() => service.exited || service.stdout.includes('YUVI is ready.'));
    assert.ok(!service.exited, service.stderr); return service;
  }
  async function stop(s, signal = 'SIGTERM') { if (!s.exited) s.child.kill(signal); await s.exit; }
  const events = async s => (await fetch(s.url + '/api/events')).json();
  const post = (s, text = '测试消息') => fetch(s.url + '/api/messages', { method: 'POST', body: JSON.stringify({ text }) });
  async function pending(s) {
    let release; const barrier = new Promise(r => release = r); t.after(() => release());
    handlers.push(async res => { res.write(delta('前半段')); await barrier; if (!res.destroyed) res.end(delta('后半段') + 'data: [DONE]\n\n'); });
    const response = await post(s), reader = response.body.getReader(); let body = '';
    while (!body.includes('event: delta')) { const part = await reader.read(); assert.ok(!part.done); body += new TextDecoder().decode(part.value); }
    return { release, reader, finish: async () => { release(); while (!(await reader.read()).done) {} } };
  }
  const snapshots = async (dir = join(data, 'snapshots')) => (await readdir(dir).catch(() => [])).filter(n => n.endsWith('.sqlite')).sort().map(n => join(dir, n));
  async function snapshot(npm = false, overrides = {}) {
    const result = await command('snapshot', [], { ...env, ...overrides }, npm); assert.equal(result.code, 0, result.stderr);
    return result.stdout.trim().split('\n').at(-1);
  }
  t.after(async () => {
    await Promise.all(children.map(s => stop(s, 'SIGKILL')));
    const closed = new Promise(r => model.close(r)); model.closeAllConnections(); await closed;
    await delay(150); await rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
    for (const s of children) assert.ok(!(s.stdout + s.stderr).includes(secret));
  });
  return { root, data, env, handlers, requests, start, spawnService, stop, events, post, pending, snapshots, snapshot };
}

test('C4/C6/C7/C8/C9/C13: runtime WAL snapshots, safe restore, interrupted recovery and service-lock isolation', async t => {
  const f = await fixture(t), a = await f.start();
  await waitFor(async () => (await f.snapshots()).some(path => { try { return !!verifySnapshot(path); } catch { return false; } }));
  const generation = await f.pending(a), pending = await f.events(a);
  const lockBefore = hash(await readFile(join(f.data, 'service.lock')));
  const snapshotList = await f.snapshots(), requestCount = f.requests.length;
  const b = await f.spawnService(); await b.exit;
  assert.notEqual(b.code, 0); assert.match(b.stderr, /YUVI_DATA_DIR/);
  assert.deepEqual(await f.events(a), pending); assert.deepEqual(await f.snapshots(), snapshotList); assert.equal(f.requests.length, requestCount);
  const first = await f.snapshot(true); assert.deepEqual(rows(first), pending);
  assert.deepEqual(pending.map(e => e.kind), ['heard', 'presented', 'reply_attempt']);
  const verification = await command('verify-snapshot', [first], {}, true); assert.equal(verification.code, 0, verification.stderr);
  assert.deepEqual(JSON.parse(verification.stdout.trim().split('\n').at(-1)), { events: 3, max_seq: 3 });
  assert.equal(hash(await readFile(join(f.data, 'service.lock'))), lockBefore);
  await generation.finish(); const completed = await f.events(a);
  const second = await f.snapshot(true); assert.deepEqual(rows(second), completed); assert.equal(completed.at(-1).kind, 'said');
  const liveFiles = await filesTree(f.data);
  const refused = await command('restore', [second, f.data], {}); assert.notEqual(refused.code, 0);
  assert.deepEqual(await filesTree(f.data), liveFiles);
  const nonempty = join(f.root, 'nonempty'); await mkdir(nonempty); await writeFile(join(nonempty, 'keep'), 'untouched');
  const beforeTarget = await filesTree(nonempty);
  assert.notEqual((await command('restore', [second, nonempty], {})).code, 0); assert.deepEqual(await filesTree(nonempty), beforeTarget);
  await f.stop(a, 'SIGKILL'); const restarted = await f.start(); assert.deepEqual(await f.events(restarted), completed); await f.stop(restarted);
  await delay(100);
  const original = await filesTree(f.data), snapshotHash = hash(await readFile(second));
  const target = join(f.root, 'restored');
  assert.equal((await command('restore', [second, target], {}, true)).code, 0);
  assert.equal(hash(await readFile(second)), snapshotHash); assert.deepEqual(await filesTree(f.data), original);
  const restored = rows(join(target, 'archive.sqlite'));
  assert.deepEqual(restored.slice(0, -1), completed);
  const marker = restored.at(-1), info = verifySnapshot(second);
  assert.equal(marker.class, 'control'); assert.equal(marker.kind, 'restored'); assert.equal(marker.actor, 'system');
  assert.equal(marker.scene, 'unknown'); assert.equal(marker.branch, completed.at(-1).branch); assert.equal(marker.content, '');
  assert.deepEqual(marker.meta, { through_seq: info.max_seq, through_id: info.max_id, snapshot_sha256: info.sha256 });
  const c = await f.start({ YUVI_DATA_DIR: target }); await (await f.post(c, '恢复后的消息')).text();
  assert.equal((await f.events(c)).at(-1).kind, 'said');
  const context = JSON.stringify(f.requests.at(-1).messages); assert.ok(context.includes('测试消息') && context.includes('前半段后半段'));
  assert.ok(!context.includes(marker.id) && !context.includes('restored'));
  const midTarget = join(f.root, 'restored-mid'); await mkdir(midTarget, { mode: 0o700 });
  assert.equal((await command('restore', [first, midTarget], {})).code, 0);
  const beforeCalls = f.requests.length, mid = await f.start({ YUVI_DATA_DIR: midTarget });
  const midEvents = await f.events(mid); const errors = midEvents.filter(e => e.kind === 'error');
  assert.equal(errors.length, 1); assert.equal(errors[0].meta.reason, 'interrupted'); assert.equal(errors[0].meta.outcome, 'unknown');
  await delay(3000); assert.equal(f.requests.length, beforeCalls);
  async function permissions(path) {
    assert.equal((await stat(path)).mode & 0o077, 0);
    for (const item of await readdir(path, { withFileTypes: true })) {
      const name = join(path, item.name);
      if (item.isDirectory()) await permissions(name);
      else { assert.equal((await stat(name)).mode & 0o077, 0); assert.ok(!(await readFile(name)).includes(Buffer.from(secret))); }
    }
  }
  await permissions(join(f.data, 'snapshots')); await permissions(target); await permissions(midTarget);
});

test('C3: startup and interval snapshots during a four-second turn, no event annotations', async t => {
  const f = await fixture(t), a = await f.start({ YUVI_SNAPSHOT_INTERVAL_MS: '3000' });
  await waitFor(async () => (await f.snapshots()).length >= 1, 5000);
  await (await f.post(a, '第一句')).text();
  const generation = await f.pending(a); await delay(4100); await generation.finish();
  await (await f.post(a, '最后一句')).text(); const events = await f.events(a);
  await waitFor(async () => (await f.snapshots()).some(p => { try { return verifySnapshot(p).max_seq === events.at(-1).seq; } catch { return false; } }), 5000);
  const files = await f.snapshots(); assert.ok(files.length >= 3);
  for (const file of files) {
    const info = verifySnapshot(file); assert.deepEqual(rows(file), events.filter(e => e.seq <= info.max_seq));
  }
  assert.equal(events.filter(e => e.kind === 'heard').length, 3); assert.equal(events.filter(e => e.kind === 'said').length, 3);
  assert.equal(events.length, 12);
});

test('C5/C7: byte edits, truncation, invalid SQLite and missing triggers are refused before restore writes', async t => {
  const f = await fixture(t); const seed = new Archive(f.data);
  seed.append({ class: 'experience', kind: 'heard', actor: 'owner', content: 'fixture' }); seed.close();
  const good = await f.snapshot(); const bytes = await readFile(good), manifest = JSON.parse(await readFile(good + '.json', 'utf8'));
  const variants = [0, Math.floor(bytes.length / 2), bytes.length - 1, 'truncate'];
  for (const [i, offset] of variants.entries()) {
    const bad = join(f.root, 'bad-' + i + '.sqlite'); const changed = Buffer.from(bytes);
    if (offset !== 'truncate') changed[offset] ^= 1;
    await writeFile(bad, offset === 'truncate' ? changed.subarray(0, changed.length - 100) : changed);
    await writeFile(bad + '.json', JSON.stringify(manifest));
    const verify = await command('verify-snapshot', [bad], {}); assert.notEqual(verify.code, 0); assert.match(verify.stderr, /SHA-256/);
    const target = join(f.root, 'bad-target-' + i);
    const result = await command('restore', [bad, target], {}); assert.notEqual(result.code, 0);
    await assert.rejects(stat(target), { code: 'ENOENT' });
  }
  for (const kind of ['schema', 'extra-table', 'integrity']) {
    const bad = join(f.root, kind + '.sqlite'); await copyFile(good, bad);
    if (kind === 'schema') {
      const db = new DatabaseSync(bad); db.exec('DROP TRIGGER events_no_update'); db.close();
    } else if (kind === 'extra-table') {
      const db = new DatabaseSync(bad); db.exec('CREATE TABLE sqliteExtra (value TEXT)'); db.close();
    } else { const changed = await readFile(bad); changed.fill(0, 0, 100); await writeFile(bad, changed); }
    await writeFile(bad + '.json', JSON.stringify({ ...manifest, sha256: hash(await readFile(bad)) }));
    const result = await command('verify-snapshot', [bad], {}); assert.notEqual(result.code, 0); assert.match(result.stderr, /SQLite|schema|triggers/);
  }
});

test('C10: corrupt archives refuse startup without changing bytes; new-directory recovery succeeds', async t => {
  const f = await fixture(t), a = await f.start();
  await (await f.post(a)).text();
  const good = await f.snapshot(); await f.stop(a);
  const original = await readFile(join(f.data, 'archive.sqlite'));
  for (const kind of ['truncate', 'page', 'schema']) {
    const data = join(f.root, 'corrupt-' + kind); await mkdir(data, { mode: 0o700 });
    const file = join(data, 'archive.sqlite'); const changed = Buffer.from(original);
    if (kind === 'truncate') await writeFile(file, changed.subarray(0, Math.floor(changed.length / 2)));
    else if (kind === 'page') { changed.fill(0xff, Math.floor(changed.length / 2), Math.min(changed.length, Math.floor(changed.length / 2) + 4096)); await writeFile(file, changed); }
    else { await writeFile(file, changed); const db = new DatabaseSync(file); db.exec('DROP TRIGGER events_no_delete'); db.close(); }
    const before = hash(await readFile(file)); const bad = await f.spawnService({ YUVI_DATA_DIR: data }); await bad.exit;
    assert.notEqual(bad.code, 0); assert.match(bad.stderr, /YUVI_DATA_DIR.*snapshot/i); assert.equal(hash(await readFile(file)), before);
  }
  const target = join(f.root, 'healthy-restore'); assert.equal((await command('restore', [good, target], {})).code, 0);
  const recovered = await f.start({ YUVI_DATA_DIR: target }); assert.ok((await (await f.post(recovered)).text()).includes('event: done'));
});

test('C12: invalid snapshot configuration fails without recovering pending events or leaking credentials', async t => {
  const f = await fixture(t); const seed = new Archive(f.data);
  seed.append({ class: 'experience', kind: 'heard', actor: 'owner', content: 'must stay pending' }); seed.close();
  const original = rows(join(f.data, 'archive.sqlite'));
  const regular = join(f.root, 'not-directory'); await writeFile(regular, 'keep');
  for (const override of [{ YUVI_SNAPSHOT_DIR: regular }, { YUVI_SNAPSHOT_DIR: f.data },
    { YUVI_SNAPSHOT_INTERVAL_MS: '0' }, { YUVI_SNAPSHOT_INTERVAL_MS: '-1' }, { YUVI_SNAPSHOT_INTERVAL_MS: '1.5' }]) {
    const s = await f.spawnService(override); await s.exit; assert.notEqual(s.code, 0);
    assert.match(s.stderr, /YUVI_SNAPSHOT_/); assert.deepEqual(rows(join(f.data, 'archive.sqlite')), original);
  }
});

test('runtime snapshot failure is diagnosed without affecting dialogue and retried after repair', async t => {
  const f = await fixture(t), dir = join(f.root, 'runtime-snapshots');
  const a = await f.start({ YUVI_SNAPSHOT_DIR: dir, YUVI_SNAPSHOT_INTERVAL_MS: '800' });
  await waitFor(async () => (await f.snapshots(dir)).length > 0);
  const old = join(f.root, 'saved-snapshots');
  const { rename } = await import('node:fs/promises'); await rename(dir, old); await writeFile(dir, 'blocked');
  await waitFor(() => a.stderr.includes('Automatic snapshot failed; will retry.'));
  assert.ok((await (await f.post(a)).text()).includes('event: done'));
  await rm(dir); await rename(old, dir);
  const max = (await f.events(a)).at(-1).seq;
  await waitFor(async () => (await f.snapshots(dir)).some(p => { try { return verifySnapshot(p).max_seq === max; } catch { return false; } }));
});

test('C2: P2-format data, schema, triggers and usage are preserved without migration', async t => {
  const f = await fixture(t); const seed = new Archive(f.data);
  const h = seed.append({ class: 'experience', kind: 'heard', actor: 'owner', content: 'old' });
  const attempt = seed.append({ class: 'act', kind: 'reply_attempt', actor: 'yuvi', reply_to: h.id, model: 'old' });
  seed.append({ class: 'act', kind: 'said', actor: 'yuvi', content: 'old reply', reply_to: h.id, model: 'old', meta: { attempt: attempt.id, usage: { prompt_tokens: 5 } } });
  const s = seed.append({ class: 'experience', kind: 'heard', actor: 'owner', content: 'silent' });
  seed.append({ class: 'act', kind: 'silent', actor: 'yuvi', reply_to: s.id, content: 'old reason', model: 'old' });
  const h2 = seed.append({ class: 'experience', kind: 'heard', actor: 'owner', content: 'error' });
  seed.append({ class: 'control', kind: 'error', actor: 'system', reply_to: h2.id, meta: { outcome: 'not_sent' } });
  const original = seed.events();
  const schema = seed.db.prepare('SELECT * FROM sqlite_master ORDER BY name').all(); seed.close();
  const a = await f.start(); assert.deepEqual(await f.events(a), original);
  await (await f.post(a)).text(); assert.deepEqual((await f.events(a)).slice(0, original.length), original);
  const db = new DatabaseSync(join(f.data, 'archive.sqlite'), { readOnly: true });
  assert.deepEqual(db.prepare('SELECT * FROM sqlite_master ORDER BY name').all(), schema); db.close();
});

function contentDigest(file) {
  const db = new DatabaseSync(file, { readOnly: true }), digest = createHash('sha256');
  try { for (const row of db.prepare('SELECT * FROM events ORDER BY seq').iterate()) digest.update(JSON.stringify(row)); return digest.digest('hex'); }
  finally { db.close(); }
}
test('C11/C13: ten actual SIGKILLs during 100000-event snapshot creation never publish a partial valid copy', async t => {
  const f = await fixture(t), seed = new Archive(f.data);
  seed.db.exec('BEGIN');
  const insert = seed.db.prepare(`INSERT INTO events (id,branch,class,kind,scene,actor,t_recorded,reply_to,content,model,meta)
    VALUES (?,'dev:v2-dev','experience','heard','web','owner',1,NULL,?,NULL,'{}')`);
  const text = 'snapshot atomicity independent fixture '.repeat(14);
  for (let i = 0; i < 100000; i++) insert.run('bulk-' + i, text);
  seed.db.exec('COMMIT'); seed.close();
  const source = join(f.data, 'archive.sqlite'), sourceHash = hash(await readFile(source)), sourceDigest = contentDigest(source);
  const dir = join(f.data, 'snapshots');
  for (const milliseconds of [0, 1, 2, 4, 8, 12, 20, 35, 50, 75]) {
    const before = new Set(await readdir(dir).catch(() => []));
    const operation = cli('snapshot', [], { YUVI_DATA_DIR: f.data });
    await waitFor(async () => (await readdir(dir).catch(() => [])).some(n => n.startsWith('.building-') && !before.has(n)));
    await delay(milliseconds); process.kill(-operation.child.pid, 'SIGKILL');
    const result = await operation.done; assert.equal(result.signal, 'SIGKILL');
    assert.equal(hash(await readFile(source)), sourceHash);
  }
  const final = await f.snapshot(); assert.equal(verifySnapshot(final).events, 100000);
  async function check(path) {
    assert.equal((await stat(path)).mode & 0o077, 0);
    for (const item of await readdir(path, { withFileTypes: true })) {
      const file = join(path, item.name);
      if (item.isDirectory()) await check(file);
      else {
        assert.equal((await stat(file)).mode & 0o077, 0);
        assert.ok(!(await readFile(file)).includes(Buffer.from(secret)));
        if (file.endsWith('.sqlite')) {
          let info; try { info = verifySnapshot(file); } catch { continue; }
          assert.equal(info.events, 100000); assert.equal(contentDigest(file), sourceDigest);
        }
      }
    }
  }
  await check(dir); assert.equal(contentDigest(final), sourceDigest); assert.equal(hash(await readFile(source)), sourceHash);
});
