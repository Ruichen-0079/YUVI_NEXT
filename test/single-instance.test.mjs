import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, writeFile, rm, symlink, copyFile, stat, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { Archive } from '../dist/archive.js';
import { createInterface } from 'node:readline';

const delta = text => `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`;
async function listen(server) {
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  return `http://127.0.0.1:${server.address().port}`;
}
async function waitFor(check, timeout = 6000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) { if (await check()) return; await delay(10); }
  throw Error('condition timed out');
}
async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'yuvi-single-instance-'));
  const dataDir = join(directory, 'data'), persona = join(directory, 'persona.txt');
  await writeFile(persona, 'Independent concurrency test');
  const handlers = [], instances = [];
  const model = createServer(async (req, res) => {
    for await (const chunk of req) { /* consume request */ }
    const handler = handlers.shift() ?? (res => res.end(delta('正常回复') + 'data: [DONE]\n\n'));
    try { await handler(res); } catch { res.destroy(); }
  });
  const base = await listen(model);
  async function prepare(path = dataDir) {
    const reservation = createServer(), url = await listen(reservation);
    await new Promise(resolve => reservation.close(resolve));
    const env = { ...process.env, YUVI_DATA_DIR: path, YUVI_PERSONA_FILE: persona,
      YUVI_MODEL_BASE_URL: base + '/v1', YUVI_MODEL_API_KEY: 'test-only-not-a-real-key',
      YUVI_MODEL: 'fake', YUVI_HOST: '127.0.0.1', YUVI_PORT: new URL(url).port,
      YUVI_MODEL_IDLE_TIMEOUT_MS: '60000', YUVI_MODEL_MAX_DURATION_MS: '600000' };
    return () => {
      const child = spawn(process.execPath, ['dist/main.js'], { env, stdio: ['ignore', 'pipe', 'pipe'] });
      const instance = { child, url, output: '', exited: false, code: undefined };
      instance.exit = once(child, 'exit').then(([code, signal]) => {
        instance.exited = true; instance.code = code; instance.signal = signal;
      });
      child.stdout.on('data', data => { instance.output += data; });
      child.stderr.on('data', data => { instance.output += data; });
      instances.push(instance); return instance;
    };
  }
  async function state(instance) {
    await waitFor(() => instance.exited || instance.output.includes('YUVI is ready.'));
    return instance.exited ? 'exited' : 'ready';
  }
  async function start(path) {
    const instance = (await prepare(path))(); assert.equal(await state(instance), 'ready', instance.output);
    return instance;
  }
  async function stop(instance, signal = 'SIGTERM') {
    if (!instance.exited) instance.child.kill(signal);
    await instance.exit;
  }
  const events = async instance => (await fetch(instance.url + '/api/events')).json();
  const post = instance => fetch(instance.url + '/api/messages', { method: 'POST', body: JSON.stringify({ text: '独立并发测试' }) });
  async function pending(instance, sent = true) {
    let release;
    const barrier = new Promise(resolve => { release = resolve; });
    t.after(() => release());
    handlers.push(async res => {
      res.writeHead(200, { 'Content-Type': 'text/event-stream' }); res.flushHeaders();
      if (sent) res.write(delta('正在生成'));
      await barrier;
      if (!res.destroyed) res.end(delta('，完成') + 'data: [DONE]\n\n');
    });
    const response = await post(instance), reader = response.body.getReader();
    let frames = '';
    while (!frames.includes(sent ? 'event: delta' : 'event: heard')) {
      const part = await reader.read(); assert.ok(!part.done);
      frames += new TextDecoder().decode(part.value);
    }
    return { release, reader, finish: async () => {
      release();
      while (true) { const part = await reader.read(); if (part.done) break; frames += new TextDecoder().decode(part.value); }
      assert.ok(frames.includes('event: done'));
    } };
  }
  t.after(async () => {
    await Promise.all(instances.map(i => stop(i, 'SIGKILL')));
    const closed = new Promise(resolve => model.close(resolve)); model.closeAllConnections(); await closed;
    await rm(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
  });
  return { directory, dataDir, prepare, state, start, stop, events, post, pending };
}

test('second real process cannot recover a live generation or write a contradictory ending', async t => {
  const f = await fixture(t), a = await f.start(), generation = await f.pending(a);
  const before = await f.events(a);
  assert.deepEqual(before.map(e => e.kind), ['heard', 'presented', 'reply_attempt']);
  const b = (await f.prepare())(), bState = await f.state(b);
  const whileGenerating = await f.events(a);
  await generation.finish();
  const after = await f.events(a);
  console.log(JSON.stringify({ second_process: bState, event_kinds: after.map(e => e.kind) }));
  assert.equal(bState, 'exited', 'second process must refuse startup');
  assert.notEqual(b.code, 0); assert.match(b.output, /YUVI_DATA_DIR.*in use/);
  assert.deepEqual(whileGenerating, before, 'rejected startup must not append recovery errors');
  assert.deepEqual(after.map(e => e.kind), ['heard', 'presented', 'reply_attempt', 'said']);
  assert.equal(after.at(-1).content, '正在生成，完成');
  assert.equal((await fetch(a.url + '/health')).status, 200);
});

for (const sent of [false, true]) test(`SIGKILL releases ownership and recovery happens once (${sent ? 'unknown' : 'not_sent'})`, async t => {
  const f = await fixture(t), a = await f.start(), generation = await f.pending(a, sent);
  const before = await f.events(a);
  const blocked = (await f.prepare())(); assert.equal(await f.state(blocked), 'exited');
  assert.deepEqual(await f.events(a), before);
  await f.stop(a, 'SIGKILL');
  generation.release(); await generation.reader.cancel().catch(() => {});
  const b = await f.start(), recovered = await f.events(b);
  assert.deepEqual(recovered.slice(0, before.length), before);
  assert.equal(recovered.length, before.length + 1);
  assert.equal(recovered.at(-1).kind, 'error');
  assert.equal(recovered.at(-1).meta.reason, 'interrupted');
  assert.equal(recovered.at(-1).meta.outcome, sent ? 'unknown' : 'not_sent');
  if (sent) assert.equal(recovered.at(-1).meta.attempt, before.find(e => e.kind === 'reply_attempt').id);
  await f.stop(b);
  const c = await f.start(); assert.deepEqual(await f.events(c), recovered);
  assert.ok((await (await f.post(c)).text()).includes('event: done'));
  const final = await f.events(c);
  assert.deepEqual(final.slice(0, recovered.length), recovered);
  assert.equal(final.at(-1).kind, 'said');
  assert.ok(final.every((e, i) => !i || e.seq > final[i - 1].seq));
});

test('normal shutdown releases ownership and retains completed P1/P2 events', async t => {
  const f = await fixture(t), a = await f.start();
  await (await f.post(a)).text();
  const before = await f.events(a); assert.equal(before.at(-1).kind, 'said');
  await f.stop(a);
  const b = await f.start(); assert.deepEqual(await f.events(b), before);
  assert.ok((await (await f.post(b)).text()).includes('event: done'));
  assert.deepEqual((await f.events(b)).slice(0, before.length), before);
});

test('concurrent startup chooses exactly one process on fresh and existing archives', async t => {
  const f = await fixture(t);
  for (let round = 0; round < 3; round++) {
    // Prepare all ports before spawning, then release all contestants in one turn.
    const launch = await Promise.all(Array.from({ length: 6 }, () => f.prepare()));
    const instances = launch.map(start => start());
    const states = await Promise.all(instances.map(f.state));
    assert.equal(states.filter(state => state === 'ready').length, 1, JSON.stringify(states));
    const owner = instances[states.indexOf('ready')];
    for (const loser of instances.filter(i => i !== owner)) {
      assert.notEqual(loser.code, 0); assert.match(loser.output, /YUVI_DATA_DIR.*in use/);
    }
    const before = await f.events(owner);
    assert.equal(before.filter(e => e.kind === 'error').length, 0);
    assert.ok((await (await f.post(owner)).text()).includes('event: done'));
    const after = await f.events(owner);
    assert.deepEqual(after.slice(0, before.length), before);
    assert.equal(after.filter(e => e.kind === 'said').length, round + 1);
    await f.stop(owner, round === 1 ? 'SIGKILL' : 'SIGTERM');
  }
});

test('directory symlink and relative path aliases cannot obtain independent ownership', async t => {
  const f = await fixture(t), a = await f.start();
  const alias = join(f.directory, 'alias'); await symlink(f.dataDir, alias, 'dir');
  for (const path of [alias, join(f.dataDir, '..', 'data'), f.dataDir + '/.']) {
    const b = (await f.prepare(path))();
    assert.equal(await f.state(b), 'exited'); assert.notEqual(b.code, 0);
    assert.match(b.output, /YUVI_DATA_DIR.*in use/);
  }
  assert.deepEqual(await f.events(a), []);
  assert.ok((await (await f.post(a)).text()).includes('event: done'));
});

test('existing P1/P2 events and a legacy NORMAL-mode crash WAL remain intact', async t => {
  const f = await fixture(t);
  const archive = new Archive(f.dataDir);
  const heard = archive.append({ class: 'experience', kind: 'heard', actor: 'owner', content: '旧回复' });
  const attempt = archive.append({ class: 'act', kind: 'reply_attempt', actor: 'yuvi', reply_to: heard.id, model: 'old' });
  archive.append({ class: 'act', kind: 'said', actor: 'yuvi', reply_to: heard.id, model: 'old', content: '原文',
    meta: { attempt: attempt.id, usage: { prompt_tokens: 2, completion_tokens: 3 } } });
  const silentHeard = archive.append({ class: 'experience', kind: 'heard', actor: 'owner', content: '旧沉默' });
  archive.append({ class: 'act', kind: 'silent', actor: 'yuvi', reply_to: silentHeard.id, model: 'old', content: '原理由',
    meta: { usage: { prompt_tokens: 4, completion_tokens: 1 } } });
  const original = archive.events(); archive.close();
  // Emulate the pre-fix connection mode, commit events to WAL, then crash while
  // retaining its connection so the next startup must open an existing crash WAL.
  const script = `
    import { DatabaseSync } from 'node:sqlite';
    import { join } from 'node:path';
    const db = new DatabaseSync(join(process.argv[1], 'archive.sqlite'));
    db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;');
    const insert = db.prepare("INSERT INTO events (id,branch,class,kind,scene,actor,t_recorded,reply_to,content,model,meta) VALUES (?,'dev:v2-dev',?,?,'web',?,?,?,'',?,'{}')");
    insert.run('legacy-heard','experience','heard','owner',Date.now(),null,null);
    insert.run('legacy-attempt','act','reply_attempt','yuvi',Date.now(),'legacy-heard','old');
    console.log('legacy-ready');
    setInterval(() => {}, 1000);
  `;
  const legacy = spawn(process.execPath, ['--input-type=module', '-e', script, f.dataDir], { stdio: ['ignore', 'pipe', 'pipe'] });
  const exit = once(legacy, 'exit'); let ready = false, output = '';
  legacy.stdout.on('data', d => { ready ||= d.toString().includes('legacy-ready'); });
  legacy.stderr.on('data', d => { output += d; });
  t.after(async () => { legacy.kill('SIGKILL'); await exit; });
  await waitFor(() => ready); assert.ok(!output.includes('Error'));
  legacy.kill('SIGKILL'); await exit;
  const owner = await f.start(), events = await f.events(owner);
  assert.deepEqual(events.slice(0, original.length), original);
  assert.deepEqual(events.slice(original.length).map(e => e.kind), ['heard', 'reply_attempt', 'error']);
  assert.equal(events.at(-1).reply_to, 'legacy-heard');
  assert.equal(events.at(-1).meta.attempt, 'legacy-attempt');
  assert.equal(events.at(-1).meta.outcome, 'unknown');
  assert.equal(events.at(-1).meta.reason, 'interrupted');
  const usage = await (await fetch(owner.url + '/api/usage')).json();
  assert.equal(usage[0].turns, 3); assert.equal(usage[0].turns_with_usage, 2);
  assert.equal(usage[0].prompt_tokens, 6); assert.equal(usage[0].completion_tokens, 4);
  await f.stop(owner);
  const again = await f.start(); assert.deepEqual(await f.events(again), events);
});

// A separate OS process with a read-only source connection. It never uses Archive
// or the service-instance lock, and remains open until the test explicitly stops it.
async function readerProcess(t, source) {
  const script = `
    import { DatabaseSync } from 'node:sqlite';
    import { createInterface } from 'node:readline';
    const db = new DatabaseSync(process.argv[1], { readOnly: true });
    db.exec('PRAGMA busy_timeout=0;');
    const events = () => db.prepare('SELECT * FROM events ORDER BY seq').all();
    const reply = value => console.log(JSON.stringify(value));
    try { reply({ ready: true, events: events() }); }
    catch { reply({ error: 'read failed' }); process.exit(1); }
    for await (const line of createInterface({ input: process.stdin })) {
      const command = JSON.parse(line);
      try {
        if (command.action === 'snapshot') {
          db.prepare('VACUUM INTO ?').run(command.path);
          const copy = new DatabaseSync(command.path, { readOnly: true });
          const rows = copy.prepare('SELECT * FROM events ORDER BY seq').all();
          const integrity = copy.prepare('PRAGMA integrity_check').get();
          copy.close(); reply({ events: rows, integrity });
        } else if (command.action === 'begin') {
          db.exec('BEGIN;'); reply({ events: events() });
        } else if (command.action === 'commit') {
          db.exec('COMMIT;'); reply({ events: events() });
        } else reply({ events: events() });
      } catch { reply({ error: 'reader command failed' }); }
    }
    db.close();
  `;
  const child = spawn(process.execPath, ['--input-type=module', '-e', script, source], { stdio: ['pipe', 'pipe', 'pipe'] });
  const exit = once(child, 'exit'); const lines = createInterface({ input: child.stdout });
  const iterator = lines[Symbol.asyncIterator]();
  const next = async () => {
    const value = await iterator.next(); assert.ok(!value.done, 'reader exited unexpectedly');
    const result = JSON.parse(value.value); assert.ok(!result.error, JSON.stringify(result)); return result;
  };
  t.after(async () => { child.stdin.end(); child.kill('SIGKILL'); await exit; lines.close(); });
  const ready = await next(); assert.equal(ready.ready, true);
  return { initial: ready.events, command: async command => {
    child.stdin.write(JSON.stringify(command) + '\n'); return next();
  } };
}
function decodeRows(rows) { return rows.map(row => ({ ...row, meta: JSON.parse(row.meta) })); }

test('independent read-only process reads live WAL and takes consistent copies without weakening the service lock', async t => {
  const f = await fixture(t);
  // Open an independent reader before the service to ensure a reader is not
  // mistaken for a running service. Pin its view while the service writes.
  const seed = new Archive(f.dataDir); seed.close();
  const source = join(f.dataDir, 'archive.sqlite');
  const reader = await readerProcess(t, source);
  assert.deepEqual(reader.initial, []);
  await reader.command({ action: 'begin' });
  const a = await f.start(), generation = await f.pending(a);
  const pending = await f.events(a);
  assert.deepEqual(pending.map(e => e.kind), ['heard', 'presented', 'reply_attempt']);
  assert.ok((await stat(source + '-wal')).size > 32);
  // This intentionally incomplete copy is only a test probe, not a snapshot:
  // prove that the latest events are still outside the main database file.
  const mainOnly = join(f.directory, 'main-only.sqlite'); await copyFile(source, mainOnly);
  const probe = spawn(process.execPath, ['--input-type=module', '-e', `
    import { DatabaseSync } from 'node:sqlite';
    const db = new DatabaseSync(process.argv[1], { readOnly: true });
    console.log(db.prepare('SELECT count(*) AS n FROM events').get().n); db.close();
  `, mainOnly], { stdio: ['ignore', 'pipe', 'pipe'] });
  let count = ''; probe.stdout.on('data', d => { count += d; });
  const [probeCode] = await once(probe, 'exit'); assert.equal(probeCode, 0); assert.equal(Number(count.trim()), 0);
  const latest = await reader.command({ action: 'commit' });
  assert.deepEqual(decodeRows(latest.events), pending, 'new read sees commits from WAL');
  const first = await reader.command({ action: 'snapshot', path: join(f.directory, 'pending-copy.sqlite') });
  assert.deepEqual(decodeRows(first.events), pending);
  assert.deepEqual(Object.values(first.integrity), ['ok']);
  const b = (await f.prepare())(); assert.equal(await f.state(b), 'exited');
  assert.notEqual(b.code, 0); assert.match(b.output, /YUVI_DATA_DIR.*in use/);
  assert.deepEqual(await f.events(a), pending);
  await generation.finish();
  const complete = await f.events(a);
  assert.deepEqual(complete.map(e => e.kind), ['heard', 'presented', 'reply_attempt', 'said']);
  const second = await reader.command({ action: 'snapshot', path: join(f.directory, 'complete-copy.sqlite') });
  assert.deepEqual(decodeRows(second.events), complete);
  assert.deepEqual(Object.values(second.integrity), ['ok']);
  assert.deepEqual(decodeRows((await reader.command({ action: 'read' })).events), complete);
  await f.stop(a);
  // The still-open reader must not retain service ownership after A exits.
  const c = await f.start(); assert.deepEqual(await f.events(c), complete);
});


test('archive-open failure releases service ownership before another startup', async t => {
  const f = await fixture(t);
  const badPath = join(f.dataDir, 'archive.sqlite');
  await mkdir(badPath, { recursive: true });
  assert.throws(() => new Archive(f.dataDir));
  await rm(badPath, { recursive: true });
  const a = await f.start();
  assert.deepEqual(await f.events(a), []);
  assert.ok((await (await f.post(a)).text()).includes('event: done'));
});
