import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { createApp } from '../dist/server.js';

const key = 'unique-P1-secret-8bf2b50';
const persona = '人设全文\n不加语义标签。\n';
const piece = text => `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`;
// P2 adds verifiable event headers; compare the untouched original text below them.
const eventText = m => m.content.startsWith('档案事件 ') ? m.content.slice(m.content.indexOf('\n') + 1) : m.content;
async function listen(server) {
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  return `http://127.0.0.1:${server.address().port}`;
}
async function close(server) {
  const done = new Promise(resolve => server.close(resolve));
  server.closeAllConnections(); await done;
}
async function waitFor(check, ms = 6000) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (await check()) return; await delay(20); }
  throw Error('condition timed out');
}
async function fixture(t, timeout = 5000) {
  const dir = await mkdtemp(join(tmpdir(), 'yuvi-p1-'));
  const requests = [], handlers = [];
  const model = createServer(async (req, res) => {
    let body = ''; for await (const data of req) body += data;
    requests.push({ body: JSON.parse(body), path: req.url, authorization: req.headers.authorization, time: Date.now() });
    const handler = handlers.shift() ?? (async res => { res.writeHead(200, { 'Content-Type': 'text/event-stream' }); res.end(piece('我在。') + 'data: [DONE]\n\n'); });
    try { await handler(res); } catch { res.destroy(); }
  });
  const baseUrl = (await listen(model)) + '/v1';
  const config = { dataDir: dir, baseUrl, apiKey: key, model: 'fake-model', persona,
    contextEvents: 200, host: '127.0.0.1', port: 8787, idleTimeoutMs: timeout, maxDurationMs: 600_000 };
  let app = createApp(config), url = await listen(app.server);
  const f = { dir, requests, handlers, config, get app() { return app; }, get url() { return url; },
    events: async () => (await fetch(url + '/api/events')).json(),
    post: text => fetch(url + '/api/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) }),
    restart: async () => {
      await app.idle(); await close(app.server); app.archive.close();
      app = createApp(config); url = await listen(app.server);
    } };
  t.after(async () => { await app.idle(); await close(app.server); app.archive.close(); await close(model); await rm(dir, { recursive: true, force: true }); });
  return f;
}
async function collect(response, onFrame = () => {}) {
  assert.match(response.headers.get('content-type'), /text\/event-stream/);
  let buffer = ''; const frames = [];
  for await (const chunk of response.body) {
    buffer += new TextDecoder().decode(chunk);
    let end;
    while ((end = buffer.indexOf('\n\n')) >= 0) {
      const frame = buffer.slice(0, end); buffer = buffer.slice(end + 2);
      const [event, data] = frame.split('\n');
      const value = { event: event.slice(7), data: data.slice(6) };
      frames.push(value); await onFrame(value);
    }
  }
  return frames;
}
function assertError(events, outcome, content = '') {
  const error = events.find(e => e.kind === 'error'); assert.ok(error);
  assert.equal(error.meta.outcome, outcome); assert.equal(error.content, content);
  assert.equal(error.reply_to, events.find(e => e.kind === 'heard').id);
  assert.equal(events.filter(e => e.kind === 'said').length, 0);
  if (outcome !== 'not_sent') assert.equal(error.meta.attempt, events.find(e => e.kind === 'reply_attempt').id);
  else assert.equal(events.filter(e => e.kind === 'reply_attempt').length, 0);
  return error;
}

test('A2–A6: durable ordered events, first-delta barrier, context and SQL immutability', async t => {
  const f = await fixture(t);
  assert.deepEqual(await (await fetch(f.url + '/health')).json(), { ok: true });
  f.handlers.push(async res => {
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    const chunks = ['我', '在', '', '。', ''];
    for (let i = 0; i < chunks.length; i++) { res.write(piece(chunks[i])); await delay(i === 0 ? 2000 : 60); }
    res.end('data: [DONE]\n\n');
  });
  const frames = await collect(await f.post('你好'), async frame => {
    if (frame.event === 'delta') {
      const events = await f.events(); assert.ok(events.some(e => e.kind === 'reply_attempt'));
      assert.ok(!events.some(e => e.kind === 'said'));
    }
  });
  assert.equal(frames[0].event, 'heard'); assert.equal(frames.at(-1).event, 'done');
  assert.equal(frames.filter(f => f.event === 'delta').map(f => JSON.parse(f.data).text).join(''), '我在。');
  let events = await f.events();
  assert.deepEqual(events.map(e => e.kind), ['heard', 'reply_attempt', 'said']);
  for (const event of events) {
    for (const field of ['seq', 'id', 'branch', 'class', 'kind', 'scene', 'actor', 't_recorded', 'reply_to', 'content', 'model', 'meta']) assert.ok(field in event);
    assert.equal(event.branch, 'dev:v2-dev'); assert.equal(event.scene, 'web');
  }
  assert.equal(events[0].actor, 'owner'); assert.equal(events[1].actor, 'yuvi'); assert.equal(events[2].actor, 'yuvi');
  assert.equal(events[1].model, 'fake-model'); assert.equal(events[2].model, 'fake-model');
  assert.equal(events[1].reply_to, events[0].id); assert.equal(events[2].reply_to, events[0].id);
  assert.equal(events[2].meta.attempt, events[1].id);
  assert.equal(frames[0].data, events[0].id); assert.equal(frames.at(-1).data, events[2].id);
  await collect(await f.post('第二句'));
  assert.deepEqual(f.requests[1].body.messages.slice(0, -1).map(m => ({ ...m, content: eventText(m) })), [
    { role: 'system', content: persona }, { role: 'user', content: '你好' },
    { role: 'assistant', content: '我在。' }, { role: 'user', content: '第二句' }
  ]);
  assert.equal(f.requests[0].path, '/v1/chat/completions'); assert.equal(f.requests[0].authorization, 'Bearer ' + key);
  events = await f.events(); await f.restart(); assert.deepEqual(await f.events(), events);
  await collect(await f.post('重启后'));
  assert.ok(f.requests[2].body.messages.some(m => eventText(m) === '第二句'));
  const all = await f.events(); assert.ok(all.every((e, i) => !i || e.seq > all[i - 1].seq));
  assert.deepEqual(await (await fetch(f.url + '/api/events?after=3')).json(), all.filter(e => e.seq > 3));
  assert.throws(() => f.app.archive.db.exec("UPDATE events SET content='changed'"), /append-only/);
  assert.throws(() => f.app.archive.db.exec('DELETE FROM events'), /append-only/);
  assert.throws(() => f.app.archive.db.exec('INSERT OR REPLACE INTO events SELECT * FROM events WHERE seq=1'), /append-only/);
  assert.deepEqual(await f.events(), all);
});

test('A7: HTTP failure cannot leak upstream credentials, subsequent turn succeeds', async t => {
  const f = await fixture(t);
  f.handlers.push(async res => { res.writeHead(500); res.end(key); });
  const frames = await collect(await f.post('失败'));
  assert.equal(frames.at(-1).event, 'error'); assertError(await f.events(), 'not_sent');
  assert.ok(!JSON.stringify(frames).includes(key));
  await collect(await f.post('继续'));
  assert.equal((await f.events()).at(-1).kind, 'said');
  assert.deepEqual(f.requests[1].body.messages.slice(0, -1).map(m => ({ ...m, content: eventText(m) })), [{ role: 'system', content: persona },
    { role: 'user', content: '失败' }, { role: 'user', content: '继续' }]);
  await f.restart();
  for (const name of await readdir(f.dir)) assert.equal((await readFile(join(f.dir, name))).includes(Buffer.from(key)), false);
});

test('A7b: partial stream disconnect preserves exactly the emitted content', async t => {
  const f = await fixture(t);
  f.handlers.push(async res => {
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    res.write(piece('我在')); await delay(40); res.write(piece('想')); await delay(40); res.destroy();
  });
  const frames = await collect(await f.post('断开'));
  assert.deepEqual(frames.map(f => f.event), ['heard', 'delta', 'delta', 'error']);
  assertError(await f.events(), 'partial', '我在想');
});

for (const partial of [false, true]) test(`timeout ${partial ? 'after' : 'before'} first delta`, async t => {
  const f = await fixture(t, 120);
  f.handlers.push(async res => {
    res.writeHead(200, { 'Content-Type': 'text/event-stream' }); res.flushHeaders();
    if (partial) res.write(piece('片段'));
  });
  const frames = await collect(await f.post('超时'));
  assert.equal(frames.at(-1).event, 'error');
  assertError(await f.events(), partial ? 'partial' : 'not_sent', partial ? '片段' : '');
});

test('A9: concurrent arrival queues generation and second context includes first reply', async t => {
  const f = await fixture(t); let ended = 0;
  f.handlers.push(async res => { res.writeHead(200); res.write(piece('第一回复')); await delay(1000); ended = Date.now(); res.end('data: [DONE]\n\n'); });
  const first = f.post('第一'); await delay(100); const second = f.post('第二');
  await waitFor(async () => (await f.events()).filter(e => e.kind === 'heard').length === 2);
  assert.equal((await f.events()).filter(e => e.kind === 'said').length, 0);
  assert.equal(f.requests.length, 1);
  await Promise.all([first.then(r => collect(r)), second.then(r => collect(r))]);
  const events = await f.events();
  assert.deepEqual(events.filter(e => e.kind === 'heard').map(e => e.content), ['第一', '第二']);
  assert.deepEqual(events.filter(e => e.kind === 'said').map(e => e.reply_to), events.filter(e => e.kind === 'heard').map(e => e.id));
  assert.ok(f.requests[1].time >= ended);
  assert.ok(f.requests[1].body.messages.some(m => eventText(m) === '第一回复'));
});

test('A10 and invalid requests leave archive unchanged', async t => {
  const f = await fixture(t);
  for (const text of ['', '   ', null, 123]) assert.equal((await f.post(text)).status, 400);
  const bad = await fetch(f.url + '/api/messages', { method: 'POST', body: '{' }); assert.equal(bad.status, 400);
  assert.deepEqual(await f.events(), []);
  assert.equal((await fetch(f.url + '/api/events?after=no')).status, 400);
});

for (const partial of [false, true]) test(`A8${partial ? '' : 'b'}: real SIGKILL recovery ${partial ? 'unknown' : 'not_sent'}, no resend`, async t => {
  const f = await fixture(t);
  const personaFile = join(f.dir, 'persona.txt'); await writeFile(personaFile, persona);
  // Reserve a local port, then run the actual production entry point in a child.
  const reservation = createServer(); const reserved = await listen(reservation);
  const port = new URL(reserved).port; await close(reservation);
  const childDir = join(f.dir, 'child');
  const env = { ...process.env, YUVI_DATA_DIR: childDir, YUVI_MODEL_BASE_URL: f.config.baseUrl,
    YUVI_MODEL_API_KEY: key, YUVI_MODEL: 'fake-model', YUVI_PERSONA_FILE: personaFile, YUVI_PORT: port };
  let child, output = '';
  function start() {
    child = spawn(process.execPath, ['dist/main.js'], { env, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', data => { output += data; }); child.stderr.on('data', data => { output += data; });
  }
  async function stop() {
    if (child && child.exitCode === null && child.signalCode === null) {
      const exit = once(child, 'exit'); child.kill('SIGKILL'); await exit;
    }
  }
  t.after(stop);
  const url = 'http://127.0.0.1:' + port;
  async function healthy() { try { return (await fetch(url + '/health')).ok; } catch { return false; } }
  start(); await waitFor(healthy);
  f.handlers.push(async res => {
    res.writeHead(200); res.flushHeaders();
    if (partial) { res.write(piece('我在')); await delay(40); res.write(piece('想')); }
  });
  const response = await fetch(url + '/api/messages', { method: 'POST', body: JSON.stringify({ text: '被中断的消息' }) });
  const reader = response.body.getReader(); let received = '';
  while (!received.includes(partial ? '想' : 'event: heard')) {
    const { value } = await reader.read(); received += new TextDecoder().decode(value);
  }
  if (!partial) await waitFor(() => f.requests.length === 1);
  await stop(); await reader.cancel().catch(() => {});
  const calls = f.requests.length;
  start(); await waitFor(healthy);
  let events = await (await fetch(url + '/api/events')).json();
  const error = assertError(events, partial ? 'unknown' : 'not_sent');
  assert.equal(error.meta.reason, 'interrupted'); await delay(150); assert.equal(f.requests.length, calls);
  await collect(await fetch(url + '/api/messages', { method: 'POST', body: JSON.stringify({ text: '继续生活' }) }));
  assert.ok(f.requests.at(-1).body.messages.some(m => eventText(m) === '被中断的消息'));
  events = await (await fetch(url + '/api/events')).json();
  assert.equal(events.filter(e => e.kind === 'error').length, 1);
  await stop(); start(); await waitFor(healthy);
  assert.deepEqual(await (await fetch(url + '/api/events')).json(), events);
  await stop(); assert.ok(!output.includes(key));
  for (const name of await readdir(childDir)) assert.equal((await readFile(join(childDir, name))).includes(Buffer.from(key)), false);
});

test('context limit counts conversation events, excludes attempt and control', async t => {
  const f = await fixture(t); const archive = f.app.archive;
  archive.append({ class: 'experience', kind: 'heard', actor: 'owner', content: '一' });
  archive.append({ class: 'control', kind: 'error', actor: 'system' });
  archive.append({ class: 'experience', kind: 'heard', actor: 'owner', content: '二' });
  archive.append({ class: 'act', kind: 'reply_attempt', actor: 'yuvi' });
  archive.append({ class: 'act', kind: 'said', actor: 'yuvi', content: '三' });
  assert.deepEqual(archive.context(2).map(e => e.content), ['二', '三']);
});

test('SSE parser preserves fragmented UTF-8 and CRLF, ignores comments and metadata', async t => {
  const f = await fixture(t);
  f.handlers.push(async res => {
    res.writeHead(200);
    const bytes = Buffer.from(': keepalive\r\nevent: message\r\ndata: {"choices":[{"delta":{"content":"你好"}}]}\r\n\r\ndata: [DONE]\r\n\r\n');
    for (const byte of bytes) { res.write(Buffer.from([byte])); await delay(1); }
  });
  const frames = await collect(await f.post('中文'));
  assert.equal(frames.filter(f => f.event === 'delta').map(f => JSON.parse(f.data).text).join(''), '你好');
  assert.equal((await f.events()).at(-1).content, '你好');
});

for (const payload of ['data: not-json\n\n', `data: {"error":{"message":"${key}"}}\n\n`, piece('未完成')]) {
  test('invalid or unterminated provider SSE never produces said: ' + payload.slice(0, 18), async t => {
    const f = await fixture(t);
    f.handlers.push(async res => { res.writeHead(200); res.end(payload); });
    const frames = await collect(await f.post('错误流'));
    assert.equal(frames.at(-1).event, 'error');
    const events = await f.events(); assert.ok(!events.some(e => e.kind === 'said'));
    assert.ok(!JSON.stringify(events).includes(key)); assert.ok(!JSON.stringify(frames).includes(key));
  });
}
