import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, writeFile, rm, readdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { Archive } from '../dist/archive.js';

const key = 'unique-P2-secret-83ea8';
const frame = value => `data: ${JSON.stringify(value)}\n\n`;
const text = content => frame({ choices: [{ delta: { content } }] });
const tool = (name, args, index = 0) => frame({ choices: [{ delta: { tool_calls: [
  { index, function: { ...(name === undefined ? {} : { name }), ...(args === undefined ? {} : { arguments: args }) } }
] } }] });
const done = 'data: [DONE]\n\n';
async function assertNoSecret(directory, secret) {
  for (const item of await readdir(directory, { withFileTypes: true }).catch(() => [])) {
    const path = join(directory, item.name);
    if (item.isDirectory()) await assertNoSecret(path, secret);
    else {
      try { assert.ok(!(await readFile(path)).includes(Buffer.from(secret))); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
  }
}
async function listen(server) {
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  return `http://127.0.0.1:${server.address().port}`;
}
async function waitFor(check) {
  for (let i = 0; i < 300; i++) { if (await check()) return; await delay(20); }
  throw Error('condition timed out');
}
async function fixture(t, settings = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'yuvi-p2-'));
  const requests = [], handlers = [];
  const model = createServer(async (req, res) => {
    let body = ''; for await (const chunk of req) body += chunk;
    requests.push({ body: JSON.parse(body), time: Date.now() });
    const handler = handlers.shift() ?? (res => res.end(text('好') + done));
    try { await handler(res); } catch { res.destroy(); }
  });
  const base = await listen(model);
  const reserve = createServer(); const url = await listen(reserve); await new Promise(r => reserve.close(r));
  const personaFile = join(dir, 'persona.txt'); await writeFile(personaFile, '人设全文\n');
  const env = { ...process.env, YUVI_DATA_DIR: join(dir, 'data'), YUVI_PERSONA_FILE: personaFile,
    YUVI_MODEL_BASE_URL: base + '/v1', YUVI_MODEL_API_KEY: key, YUVI_MODEL: 'fake-p2',
    YUVI_HOST: '127.0.0.1', YUVI_PORT: new URL(url).port,
    YUVI_MODEL_IDLE_TIMEOUT_MS: '3000', YUVI_MODEL_MAX_DURATION_MS: '600000', ...settings };
  let child, output = '';
  async function start() {
    child = spawn(process.execPath, ['dist/main.js'], { env, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', data => { output += data; }); child.stderr.on('data', data => { output += data; });
    await waitFor(async () => { try { return (await fetch(url + '/health')).ok; } catch { return false; } });
  }
  async function stop(signal = 'SIGTERM') {
    if (child && child.exitCode === null && child.signalCode === null) {
      const exit = once(child, 'exit'); child.kill(signal); await exit;
    }
  }
  t.after(async () => {
    await stop(); const closed = new Promise(r => model.close(r)); model.closeAllConnections(); await closed;
    assert.ok(!output.includes(key));
    await assertNoSecret(env.YUVI_DATA_DIR, key);
    await rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
  });
  await start();
  return { dir, env, url, handlers, requests, start, stop,
    events: async () => (await fetch(url + '/api/events')).json(),
    usage: async () => (await fetch(url + '/api/usage')).json(),
    post: async value => {
      const response = await fetch(url + '/api/messages', { method: 'POST', body: JSON.stringify({ text: value }) });
      const output = await response.text();
      return output.trim().split('\n\n').map(block => {
        const lines = block.split('\n'); return { event: lines[0].slice(7), data: lines[1].slice(6) };
      });
    }
  };
}
function oneEnding(events) {
  for (const heard of events.filter(e => e.kind === 'heard')) {
    assert.equal(events.filter(e => e.reply_to === heard.id && ['said', 'silent', 'error'].includes(e.kind)).length, 1);
  }
}

test('B2/B3/B5/B6/B7: fragmented silence, optional reason, context and SIGTERM restart', async t => {
  const f = await fixture(t);
  f.handlers.push(res => res.end(tool('stay_', '{"reason":') + tool('silent', '"先不说"}') + done));
  const frames = await f.post('第一句');
  assert.deepEqual(frames.map(f => f.event), ['heard', 'silent']);
  let events = await f.events();
  assert.deepEqual(events.map(e => e.kind), ['heard', 'silent']);
  assert.equal(events[1].reply_to, events[0].id); assert.equal(events[1].actor, 'yuvi');
  assert.equal(events[1].model, 'fake-p2'); assert.equal(events[1].content, '先不说');
  assert.equal(frames.at(-1).data, events[1].id);
  await f.stop(); await f.start(); assert.deepEqual(await f.events(), events);
  for (const args of [undefined, '{}']) {
    f.handlers.push(res => res.end(tool('stay_silent', args) + done));
    assert.equal((await f.post('无理由')).at(-1).event, 'silent');
    assert.equal((await f.events()).at(-1).content, '');
  }
  await f.post('继续');
  const request = f.requests[1].body;
  assert.equal(request.tool_choice, 'auto'); assert.equal(request.stream_options.include_usage, true);
  assert.equal(request.tools.length, 2); assert.equal(request.tools[1].function.name, 'check'); assert.equal(request.tools[0].function.name, 'stay_silent');
  assert.equal(request.tools[0].function.parameters.properties.reason.type, 'string');
  assert.deepEqual(request.messages[0], { role: 'system', content: '人设全文\n' });
  assert.ok(request.messages.some(m => m.role === 'user' && m.content.includes('没有回复')));
  assert.ok(!request.messages.some(m => m.content.includes('先不说')));
  oneEnding(await f.events());
});

test('B4/P4 §2.5: text wins over silence; text-free stream without silence is an error', async t => {
  const f = await fixture(t);
  for (const body of [text('好') + tool('stay_silent', '{"reason":"x"}'), tool('stay_silent', '{}') + text('好')]) {
    f.handlers.push(res => res.end(body + done));
    const frames = await f.post('文本优先'); assert.equal(frames.at(-1).event, 'done');
    const events = await f.events(), said = events.at(-1);
    assert.equal(said.kind, 'said'); assert.equal(said.content, '好');
    assert.deepEqual(said.meta.ignored_tools, ['stay_silent']);
    assert.equal(events.filter(e => e.kind === 'silent').length, 0);
  }
  f.handlers.push(res => res.end(done)); await f.post('空流');
  const events = await f.events(); assert.deepEqual(events.slice(-2).map(e => e.kind), ['heard', 'error']);
  assert.equal(events.at(-1).meta.outcome, 'not_sent'); oneEnding(events);
});

test('B8: real process streams forty one-second chunks beyond P1 thirty-second cap', async t => {
  const f = await fixture(t);
  f.handlers.push(async res => {
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    for (let i = 0; i < 40; i++) { await delay(1000); res.write(text('字')); }
    res.end(done);
  });
  const started = Date.now(); const frames = await f.post('长回复');
  assert.ok(Date.now() - started >= 40_000);
  assert.equal(frames.filter(f => f.event === 'delta').length, 40);
  assert.equal(frames.at(-1).event, 'done');
  assert.equal((await f.events()).at(-1).content, '字'.repeat(40));
});

for (const partial of [false, true]) test(`B${partial ? 9 : 10}: three-second idle timeout ${partial ? 'partial' : 'not_sent'}`, async t => {
  const f = await fixture(t);
  f.handlers.push(async res => {
    if (partial) { res.write(text('甲')); await delay(50); res.write(text('乙')); }
    // No further bytes, including headers in the first-byte case.
  });
  const started = Date.now(); const frames = await f.post('挂起');
  const elapsed = Date.now() - started;
  assert.ok(elapsed >= 2900 && elapsed < 5000, 'idle deadline is 3 seconds');
  assert.equal(frames.at(-1).event, 'error'); const events = await f.events(), error = events.at(-1);
  assert.equal(error.kind, 'error'); assert.equal(error.meta.outcome, partial ? 'partial' : 'not_sent');
  assert.equal(error.content, partial ? '甲乙' : '');
  assert.equal(events.filter(e => e.kind === 'reply_attempt').length, partial ? 1 : 0);
  oneEnding(events);
});

test('maximum duration bounds a continuously active stream; comments reset idle timeout', async t => {
  const f = await fixture(t, { YUVI_MODEL_IDLE_TIMEOUT_MS: '100', YUVI_MODEL_MAX_DURATION_MS: '500' });
  f.handlers.push(async res => {
    res.write(text('好'));
    while (!res.destroyed) { await delay(30); res.write(': heartbeat\n\n'); }
  });
  const started = Date.now(); await f.post('总时长'); const elapsed = Date.now() - started;
  assert.ok(elapsed >= 450 && elapsed < 1500);
  const error = (await f.events()).at(-1); assert.equal(error.kind, 'error'); assert.equal(error.content, '好');
});

test('B11: queued turns keep raw event order and end with an ephemeral user anchor', async t => {
  const f = await fixture(t); let ended;
  f.handlers.push(async res => { res.write(text('对甲的回复')); await delay(1000); ended = Date.now(); res.end(done); });
  const first = f.post('甲'); await delay(100); const second = f.post('乙');
  await Promise.all([first, second]);
  const events = await f.events(), request = f.requests[1];
  assert.deepEqual(events.map(e => e.kind), ['heard', 'reply_attempt', 'heard', 'said', 'reply_attempt', 'said']);
  assert.ok(request.time >= ended);
  const messages = request.body.messages;
  assert.deepEqual(messages.slice(1, -1).map(m => m.content.slice(m.content.indexOf('\n') + 1)), ['甲', '乙', '对甲的回复']);
  const anchor = messages.at(-1), heard = events.find(e => e.content === '乙');
  assert.equal(anchor.role, 'user'); assert.ok(anchor.content.includes('当前回应')); assert.ok(!anchor.content.includes(heard.id)); assert.match(anchor.content, /\d{4}-\d{2}-\d{2}/); assert.ok(anchor.content.endsWith('乙'));
  assert.equal(events.length, 6); oneEnding(events);
});

test('B12: raw usage on said/silent, no estimates on 500, UTC daily sums survive restart', async t => {
  const f = await fixture(t);
  const a = { prompt_tokens: 10, completion_tokens: 3, total_tokens: 13, prompt_cache_hit_tokens: 7,
    completion_tokens_details: { reasoning_tokens: 2 }, vendor: 'unchanged' };
  const b = { prompt_tokens: 4, completion_tokens: 2, total_tokens: 6, prompt_cache_hit_tokens: 1,
    completion_tokens_details: { reasoning_tokens: 1 }, vendor: 'other' };
  f.handlers.push(res => res.end(text('好') + frame({ choices: [], usage: a }) + done));
  f.handlers.push(res => res.end(tool('stay_silent', '{}') + frame({ choices: [], usage: b }) + done));
  f.handlers.push(res => { res.writeHead(500); res.end(key); });
  await f.post('说'); await f.post('不说'); await f.post('失败');
  const events = await f.events(), endings = events.filter(e => ['said', 'silent', 'error'].includes(e.kind));
  assert.deepEqual(endings[0].meta.usage, a); assert.deepEqual(endings[1].meta.usage, b);
  assert.ok(!('usage' in endings[2].meta));
  const expected = [{ date: new Date(endings[0].t_recorded).toISOString().slice(0, 10), turns: 3, turns_with_usage: 2,
    prompt_tokens: 14, completion_tokens: 5, total_tokens: 19, prompt_cache_hit_tokens: 8,
    completion_tokens_details: { reasoning_tokens: 3 } }];
  assert.deepEqual(await f.usage(), expected);
  await f.stop(); await f.start(); assert.deepEqual(await f.usage(), expected); oneEnding(await f.events());
});

test('usage received before a broken stream belongs to its error, never estimates usage on recovery', async t => {
  const f = await fixture(t);
  const usage = { prompt_tokens: 2, completion_tokens: 1, extra: 3 };
  f.handlers.push(async res => { res.write(text('片段') + frame({ choices: [], usage })); await delay(40); res.destroy(); });
  await f.post('断开'); assert.deepEqual((await f.events()).at(-1).meta.usage, usage);
  assert.equal((await f.usage())[0].turns_with_usage, 1);
  await f.stop();
  const archive = new Archive(f.env.YUVI_DATA_DIR);
  archive.append({ class: 'experience', kind: 'heard', actor: 'owner', content: '未完成' }); archive.close();
  await f.start();
  assert.ok(!('usage' in (await f.events()).at(-1).meta));
  assert.equal((await f.usage())[0].turns, 2);
});

test('usage groups UTC dates and sums only provider numeric fields, including historical P1 endings', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'yuvi-usage-')); const archive = new Archive(dir);
  t.after(async () => { archive.close(); await rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 }); });
  const heard = archive.append({ class: 'experience', kind: 'heard', actor: 'owner' });
  const insert = archive.db.prepare(`INSERT INTO events
    (id,branch,class,kind,scene,actor,t_recorded,reply_to,content,model,meta) VALUES (?,'dev:v2-dev','act','said','web','yuvi',?,?,'','fake',?)`);
  insert.run('old', Date.parse('2020-01-01T23:59:59.999Z'), heard.id, '{}');
  insert.run('new', Date.parse('2020-01-02T00:00:00.000Z'), heard.id, JSON.stringify({ usage: { prompt_tokens: 4, completion_tokens: 1, details: { hit: 2 }, ignored: 'string' } }));
  assert.deepEqual(JSON.parse(JSON.stringify(archive.usage())), [
    { date: '2020-01-01', turns: 1, turns_with_usage: 0, prompt_tokens: 0, completion_tokens: 0 },
    { date: '2020-01-02', turns: 1, turns_with_usage: 1, prompt_tokens: 4, completion_tokens: 1, details: { hit: 2 } }
  ]);
});

test('B13: startup names missing/invalid variables without printing values or secrets', async t => {
  const f = await fixture(t); await f.stop();
  for (const [variable, value] of [['YUVI_MODEL', undefined], ['YUVI_DATA_DIR', undefined],
    ['YUVI_MODEL_BASE_URL', key], ['YUVI_MODEL_IDLE_TIMEOUT_MS', '0'], ['YUVI_MODEL_MAX_DURATION_MS', '2147483648'],
    ['YUVI_PERSONA_FILE', '/nonexistent/' + key]]) {
    const env = { ...f.env }; if (value === undefined) delete env[variable]; else env[variable] = value;
    const child = spawn(process.execPath, ['dist/main.js'], { env, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = ''; child.stdout.on('data', d => output += d); child.stderr.on('data', d => output += d);
    const [code] = await once(child, 'exit'); assert.notEqual(code, 0);
    assert.ok(output.includes(variable), output); assert.ok(!output.includes(key));
  }
});

for (const output of [tool('stay_silent', '{'), tool('unknown', '{}'), tool('stay_silent', '{"reason":1}'),
  tool('stay_silent', '{}', 0) + tool('stay_silent', '{}', 1)]) {
  test('unsupported or malformed text-free tool output is error, not invented silence', async t => {
    const f = await fixture(t); f.handlers.push(res => res.end(output + done));
    assert.equal((await f.post('不合法')).at(-1).event, 'error');
    const events = await f.events(); assert.deepEqual(events.map(e => e.kind), ['heard', 'error']);
    assert.equal(events.at(-1).meta.outcome, 'not_sent'); oneEnding(events);
  });
}
