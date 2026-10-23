import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, writeFile, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { DatabaseSync } from 'node:sqlite';
import { check as databaseCheck, localTime } from '../dist/context.js';
import { state } from './helpers/p4-context.mjs';
import { withArchive } from './helpers/archive-fixture.mjs';
// Existing array fixtures now exercise the SQLite implementation with the same rows.
const check = (source, args, owner) => databaseCheck({ search: (query, from, to) =>
  withArchive(typeof source === 'function' ? source() : source, archive => archive.search(query, from, to)) }, args, owner);
const writings = (events, budget) => withArchive(events, archive => archive.writings(budget));
import { createSnapshot, verifySnapshot, restoreSnapshot } from '../dist/snapshots.js';

process.env.TZ = 'Asia/Shanghai';
const key = 'P4-unique-secret-706d8ef';
const persona = '独立测试人设全文：meta {"p":1}\n';
const frame = value => `data: ${JSON.stringify(value)}\n\n`;
const text = content => frame({ choices: [{ delta: { content } }] });
const tools = (...calls) => frame({ choices: [{ delta: { tool_calls: calls.map(([name, args], index) =>
  ({ index, id: `request_call_${index}`, function: { name, arguments: typeof args === 'string' ? args : JSON.stringify(args) } })) } }] });
const end = (usage, finish = 'stop') => frame({ choices: [{ delta: {}, finish_reason: finish }], ...(usage ? { usage } : {}) }) + 'data: [DONE]\n\n';
async function listen(server) {
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  return `http://127.0.0.1:${server.address().port}`;
}
async function waitFor(check, timeout = 6000) {
  const until = Date.now() + timeout;
  while (Date.now() < until) { if (await check()) return; await delay(20); }
  throw Error('condition timed out');
}
async function noSecret(dir) {
  for (const item of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
    const path = join(dir, item.name);
    if (item.isSymbolicLink()) continue; // Only the test's legacy node_modules link; never scan outside its temporary tree.
    if (item.isDirectory()) await noSecret(path);
    else try { assert.ok(!(await readFile(path)).includes(Buffer.from(key)), path); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
}
async function fixture(t, settings = {}) {
  const root = await mkdtemp(join(tmpdir(), 'yuvi-p4-'));
  const requests = [], dialogue = [], consolidation = [];
  let sequence = 0, output = '';
  const model = createServer(async (req, res) => {
    let raw = ''; for await (const chunk of req) raw += chunk;
    const body = JSON.parse(raw);
    const record = { body, time: Date.now(), usage: { prompt_tokens: ++sequence, completion_tokens: sequence + 1,
      prompt_cache_hit_tokens: sequence * 2 } };
    requests.push(record);
    const handler = (body.tools ? dialogue : consolidation).shift();
    try {
      if (handler) await handler(res, record);
      else res.end(text(body.tools ? '答复' : '留下的文字') + end(record.usage));
    } catch { res.destroy(); }
  });
  const base = await listen(model);
  const reservation = createServer(), url = await listen(reservation); await new Promise(r => reservation.close(r));
  const personaFile = join(root, 'persona.txt'); await writeFile(personaFile, persona);
  const dataDir = join(root, 'data');
  const env = { ...process.env, TZ: 'Asia/Shanghai', YUVI_DATA_DIR: dataDir, YUVI_SNAPSHOT_DIR: join(root, 'snapshots'),
    YUVI_MODEL_API_KEY: key, YUVI_MODEL_BASE_URL: base + '/v1', YUVI_MODEL: 'fake-p4',
    YUVI_PERSONA_FILE: personaFile, YUVI_PORT: new URL(url).port, YUVI_HOST: '127.0.0.1',
    YUVI_CONTEXT_EVENTS: '200', YUVI_CONSOLIDATION_IDLE_MS: '2147483647',
    YUVI_MODEL_IDLE_TIMEOUT_MS: '5000', ...settings };
  let child;
  async function stop(signal = 'SIGTERM') {
    if (child && child.exitCode === null && child.signalCode === null) {
      const exited = once(child, 'exit'); child.kill(signal); await exited;
    }
  }
  async function start() {
    child = spawn(process.execPath, ['dist/main.js'], { env, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', d => output += d); child.stderr.on('data', d => output += d);
    await waitFor(async () => { try { return (await fetch(url + '/health')).ok; } catch { return false; } });
  }
  const events = async () => (await fetch(url + '/api/events')).json();
  const post = async value => (await fetch(url + '/api/messages', { method: 'POST', body: JSON.stringify({ text: value }) })).text();
  t.after(async () => {
    await stop(); const closed = new Promise(r => model.close(r)); model.closeAllConnections(); await closed;
    assert.ok(!output.includes(key));
    const terms = await readFile(new URL('../docs/TERMS.md', import.meta.url), 'utf8');
    const db = new DatabaseSync(join(env.YUVI_DATA_DIR, 'archive.sqlite'), { readOnly: true });
    try {
      for (const row of db.prepare('SELECT DISTINCT class,kind FROM events').all()) assert.ok(terms.includes('`' + row.class + '/' + row.kind + '`'));
    } finally { db.close(); }
    await noSecret(root);
    await rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
  });
  await start();
  return { root, env, url, dataDir, requests, dialogue, consolidation, post, events, stop, start,
    get output() { return output; } };
}
function oneEnding(events) {
  for (const e of events.filter(e => e.kind === 'heard')) {
    assert.equal(events.filter(r => r.reply_to === e.id && ['said', 'silent', 'error'].includes(r.kind)).length, 1);
    assert.ok(events.filter(r => r.reply_to === e.id && r.kind === 'reply_attempt').length <= 1);
  }
}
function assertUsage(events, requests, failures = []) {
  const actual = events.filter(e => e.meta.usage).map(e => e.meta.usage);
  assert.deepEqual(actual, requests.filter(r => !failures.includes(r)).map(r => r.usage));
}
function rawMessages(body, events) {
  return body.messages.filter(m => m.role !== 'system' && events.some(e => e.kind === 'heard' && m.content === `${localTime(e.t_recorded)} 小林说：\n${e.content}` ||
    e.kind === 'said' && m.role === 'assistant' && m.content === e.content));
}

// Every request is checked at the string boundary, independently of renderer internals.
function presentation(requests, events) {
  const originals = [persona, ...events.filter(e => ['heard', 'said', 'wrote'].includes(e.kind)).map(e => e.content)].filter(Boolean).sort((a, b) => b.length - a.length);
  const said = events.filter(e => e.kind === 'said').map(e => e.content);
  for (const { body } of requests) for (const m of body.messages) {
    if (m.role === 'assistant' && m.content) assert.ok(said.some(s => s.includes(m.content)), m.content);
    let generated = m.content;
    for (const original of originals) generated = generated.split(original).join('');
    assert.doesNotMatch(generated, /\b(?:seq|reply_to|actor|t_recorded|meta|heard|said|silent|inner|owner|yuvi)\b|id=|\d{13}/i);
    for (const event of events) assert.ok(!generated.includes(event.id));
  }
}

test('D3/D4/D5/D12/D13/D16/D21: idle, empty writing, serial receipt, exact presentation and usage', async t => {
  const f = await fixture(t, { YUVI_CONSOLIDATION_IDLE_MS: '2000', YUVI_CONSOLIDATION_MAX_TOKENS: '777', YUVI_OWNER_NAME: '小林' });
  f.dialogue.push((res, r) => res.end(text('reply_to said 原样回复') + end(r.usage)));
  for (const value of ['meta said heard seq=3 reply_to id=abc {"k":1}', '第二条', '第三条']) await f.post(value);
  const before = await f.events(); const lastTime = before.at(-1).t_recorded;
  let release;
  f.consolidation.push(async (res, r) => {
    await new Promise(resolve => { release = resolve; });
    res.end(text('reply_to said 私下原文') + end(r.usage));
  });
  await waitFor(() => !!release);
  const c = f.requests.at(-1);
  assert.ok(c.time - lastTime >= 2000 && c.time - lastTime <= 8000);
  assert.ok(!('tools' in c.body)); assert.equal(c.body.max_tokens, 777);
  assert.equal(c.body.stream_options.include_usage, true);
  assert.deepEqual(c.body.messages[0], { role: 'system', content: persona });
  assert.ok(!c.body.messages.some(m => m.role === 'assistant'));
  let position = -1;
  for (const e of before.filter(e => ['heard', 'said'].includes(e.kind))) {
    const next = c.body.messages[1].content.indexOf(e.content, position + 1); assert.ok(next > position); position = next;
  }
  assert.ok(c.body.messages.at(-1).content.includes('不需要完整，也不需要准确。'));
  assert.ok(c.body.messages.at(-1).content.includes('但小林能够查阅档案'));
  const response = await fetch(f.url + '/api/messages', { method: 'POST', body: JSON.stringify({ text: '整理中到达' }) });
  const reader = response.body.getReader(); const heardFrame = new TextDecoder().decode((await reader.read()).value);
  assert.match(heardFrame, /event: heard/);
  assert.equal((await f.events()).at(-1).content, '整理中到达');
  assert.equal(f.requests.at(-1), c);
  release(); let rest = ''; for (;;) { const chunk = await reader.read(); if (chunk.done) break; rest += new TextDecoder().decode(chunk.value); }
  assert.match(rest, /event: done/);
  let events = await f.events(), wrote = events.find(e => e.kind === 'wrote');
  assert.equal(wrote.content, 'reply_to said 私下原文'); assert.equal(wrote.model, 'fake-p4');
  assert.deepEqual(wrote.meta.material, { from_seq: before[0].seq, through_seq: before.at(-1).seq });
  assert.equal(wrote.meta.finish_reason, 'stop'); assert.deepEqual(wrote.meta.usage, c.usage);
  const next = f.requests.at(-1).body;
  assert.ok(next.messages[1].content.includes(wrote.content)); assert.equal(next.messages[1].role, 'user');
  assert.equal(rawMessages(next, events).length, 7);
  f.consolidation.push((res, r) => res.end(end(r.usage)));
  await waitFor(async () => (await f.events()).filter(e => e.kind === 'wrote').length === 2);
  events = await f.events(); assert.equal(events.at(-1).content, '');
  const count = f.requests.length; await delay(10_100); assert.equal(f.requests.length, count);
  await f.post('空文字之后');
  assert.ok(!f.requests.at(-1).body.messages.some(m => /写下的文字.*：\n$/.test(m.content)));
  // Finish pending idle work before inspecting exact usage and presentation.
  await f.stop();
  const db = new DatabaseSync(join(f.dataDir, 'archive.sqlite'), { readOnly: true });
  events = db.prepare('SELECT * FROM events ORDER BY seq').all().map(e => ({ ...e, meta: JSON.parse(e.meta) })); db.close();
  assertUsage(events, f.requests); presentation(f.requests, events); oneEnding(events);
});

test('D9/D10/D11/D12/D21: tool round trips, all endings, request diagnostics and one usage per call', async t => {
  const f = await fixture(t, { YUVI_OWNER_NAME: '小林', YUVI_CONTEXT_EVENTS: '10' });
  const old = '我的猫叫团子', correction = '更正：我的猫叫年糕';
  await f.post(old); await f.post(correction);
  f.consolidation.push((res, r) => res.end(text('猫 reply_to said 整理原文') + end(r.usage)));
  for (let i = 0; i < 12; i++) await f.post('无关' + i);
  f.dialogue.push((res, r) => res.end(tools(['check', { query: '猫' }]) + end(r.usage)));
  const begin = f.requests.length;
  const stream = await f.post('请查过去');
  assert.match(stream, /event: heard/); assert.match(stream, /event: done/);
  const first = f.requests[begin].body, second = f.requests[begin + 1].body;
  assert.ok(!first.messages.some(m => m.content.includes(old) || m.content.includes(correction)));
  const result = second.messages.find(m => m.role === 'tool');
  assert.ok(result.content.includes(old) && result.content.includes(correction));
  assert.ok(result.content.includes('你写下的文字')); assert.match(result.content, /\d{4}-\d{2}-\d{2}/);
  let events = await f.events(), checked = events.findLast(e => e.kind === 'checked');
  const matches = events.filter(e => ['heard', 'said', 'wrote', 'silent'].includes(e.kind) && e.content.includes('猫'));
  assert.deepEqual(checked.meta.result_seqs, matches.map(e => e.seq)); assert.deepEqual(checked.meta.arguments, { query: '猫' });
  assert.equal(second.messages.find(m => m.tool_calls).tool_calls[0].id, result.tool_call_id);
  assert.deepEqual(events.filter(e => e.reply_to === checked.reply_to).map(e => e.kind), ['presented', 'checked', 'presented', 'reply_attempt', 'said']);
  const bound = events.find(e => e.content === correction).t_recorded;
  for (const args of [{ from: new Date(bound).toISOString(), to: new Date(bound).toISOString() }, { from: '2026-02-30' }, { query: 1 }]) {
    f.dialogue.push((res, r) => res.end(tools(['check', args]) + end(r.usage)));
    await f.post('范围测试');
    const c = (await f.events()).findLast(e => e.kind === 'checked');
    if ('query' in args || args.from === '2026-02-30') { assert.equal(c.meta.invalid, true); assert.deepEqual(c.meta.result_seqs, []); }
    else assert.ok(c.meta.result_seqs.every(seq => events.find(e => e.seq === seq).t_recorded === bound));
  }
  f.dialogue.push((res, r) => res.end(text('我查一下') + tools(['check', {}]) + end(r.usage)),
    (res, r) => res.end(text('好了') + end(r.usage)));
  assert.match(await f.post('有文本的查阅'), /event: done/);
  events = await f.events(); assert.equal(events.at(-1).content, '我查一下好了');
  f.dialogue.push((res, r) => res.end(tools(['check', {}]) + end(r.usage)),
    (res, r) => res.end(tools(['stay_silent', { reason: '暂不回复' }]) + end(r.usage)));
  assert.match(await f.post('查后沉默'), /event: silent/);
  f.dialogue.push((res, r) => res.end(tools(['check', {}]) + end(r.usage)), res => { res.writeHead(500); res.end(key); });
  await f.post('查后失败');
  events = await f.events(); const error = events.at(-1), failed = f.requests.at(-1);
  assert.equal(error.meta.http_status, 500); assert.equal(error.meta.outcome, 'not_sent');
  assert.equal(error.meta.request_chars, failed.body.messages.reduce((n, m) => n + m.content.length, 0));
  const count = f.requests.length;
  for (let i = 0; i < 4; i++) f.dialogue.push((res, r) => res.end(tools(['check', {}]) + end(r.usage)));
  await f.post('始终查阅'); assert.equal(f.requests.length - count, 4);
  assert.deepEqual(f.requests.at(-1).body.tools.map(t => t.function.name), ['stay_silent']);
  assert.equal((await f.events()).at(-1).kind, 'error');
  f.dialogue.push((res, r) => res.end(tools(['check', {}], ['stay_silent', {}]) + end(r.usage)));
  await f.post('同时两个工具'); assert.equal((await f.events()).at(-1).kind, 'said');
  // Several checks in one step still own exactly one usage object.
  f.dialogue.push((res, r) => res.end(tools(['check', { query: '猫' }], ['check', { query: 'reply_to' }]) + end(r.usage)));
  await f.post('多个查阅');
  events = await f.events(); assertUsage(events, f.requests, [failed]); oneEnding(events); presentation(f.requests, events);
  const usage = await (await fetch(f.url + '/api/usage')).json();
  assert.equal(usage[0].prompt_tokens, f.requests.filter(r => r !== failed).reduce((n, r) => n + r.usage.prompt_tokens, 0));
  const endings = events.filter(e => ['said', 'silent', 'error'].includes(e.kind));
  assert.equal(usage[0].turns, endings.length); assert.equal(usage[0].turns_with_usage, endings.filter(e => e.meta.usage).length);
});

test('D7/D8/D6: thirty turns, stable bounded suffix, failure backoff and deterministic restart', async t => {
  const f = await fixture(t, { YUVI_CONTEXT_EVENTS: '10', YUVI_OWNER_NAME: '小林' });
  let failing = false, firstFailure;
  const captured = [];
  async function turn(i) {
    f.dialogue.push((res, r) => res.end(text(`回答-${i}`) + end(r.usage)));
    for (let j = 0; j < 3; j++) f.consolidation.push((res, r) => {
      if (failing) { firstFailure ??= r; r.failed = true; res.writeHead(500); res.end(key); }
      else res.end(end(r.usage));
    });
    const count = f.requests.length; await f.post(`消息-${i}`);
    // Remove unused scripted consolidation handlers, which all have the same current policy.
    f.consolidation.length = 0;
    const req = f.requests.slice(count).find(r => r.body.tools);
    const all = await f.events();
    const atRequest = all.filter(e => e.seq < all.findLast(e => e.kind === 'reply_attempt').seq);
    const dialogue = atRequest.filter(e => ['heard', 'said', 'silent'].includes(e.kind));
    const covered = Math.max(0, ...atRequest.filter(e => ['wrote', 'unconsolidated'].includes(e.kind)).map(e => e.meta.material.through_seq));
    const pending = dialogue.filter(e => e.seq > covered);
    // Decode the actual wire request, rather than using the implementation's window selector as the oracle.
    const actual = req.body.messages.slice(1, -1).map(m => {
      const event = dialogue.find(e => m.role === 'assistant' ? e.kind === 'said' && e.content === m.content :
        e.kind === 'heard' && m.content.endsWith('\n' + e.content));
      assert.ok(event, 'unexpected or missing raw record: ' + m.content); return event;
    });
    const rawSeqs = actual.map(e => e.seq);
    assert.equal(actual.at(-1).content, `消息-${i}`);
    assert.ok(actual.length <= Math.max(10, pending.length));
    for (const e of pending) assert.ok(rawSeqs.includes(e.seq));
    assert.deepEqual(rawSeqs, dialogue.slice(-rawSeqs.length).map(e => e.seq));
    const previous = captured.at(-1);
    if (previous) for (const seq of previous.rawSeqs.filter(seq => !rawSeqs.includes(seq))) assert.ok(seq <= covered);
    const start = rawSeqs[0];
    captured.push({ req, rawSeqs, start, count: dialogue.length, failing });
  }
  for (let i = 1; i <= 10; i++) await turn(i);
  failing = true;
  for (let i = 11; i <= 15; i++) await turn(i);
  assert.ok(firstFailure); assert.ok(!f.requests.some(r => r.time > firstFailure.time && !r.body.tools));
  assert.ok(!(await f.events()).some(e => e.kind === 'unconsolidated'));
  assert.match(f.output, /HTTP 500/);
  failing = false;
  const retryAt = firstFailure.time + 30_100;
  while (Date.now() < retryAt) await delay(retryAt - Date.now());
  for (let i = 16; i <= 30; i++) await turn(i);
  const retries = f.requests.filter(r => !r.body.tools && r.time > firstFailure.time);
  assert.ok(retries.length > 0, 'Consolidation must retry after backoff');
  assert.ok(retries[0].time - firstFailure.time >= 30_000);
  let events = await f.events();
  const materials = events.filter(e => e.kind === 'wrote').map(e => e.meta.material);
  const dialogue = events.filter(e => ['heard', 'said', 'silent'].includes(e.kind));
  let next = 0;
  for (const material of materials) {
    const batch = dialogue.filter(e => e.seq >= material.from_seq && e.seq <= material.through_seq);
    assert.ok(batch.length <= 10); assert.equal(batch[0].seq, dialogue[next].seq); next += batch.length;
  }
  // On successful stretches, each start movement is separated by at least ceil(N/2) additions.
  let moved;
  for (let i = 1; i < captured.length; i++) if (captured[i].start !== captured[i - 1].start) {
    if (moved && !captured.slice(captured.indexOf(moved), i + 1).some(c => c.failing)) {
      assert.ok(captured[i].count - moved.count >= 5);
    }
    moved = captured[i];
  }
  for (let i = 1; i < captured.length; i++) if (captured[i].start === captured[i - 1].start) {
    const prefix = captured[i - 1].req.body.messages.slice(0, -1);
    assert.deepEqual(captured[i].req.body.messages.slice(0, prefix.length), prefix);
  }
  // Select a boundary at which the next heard does not move the stable start.
  await turn(31);
  const previous = f.requests.at(-1).body.messages.slice(0, -1);
  await f.stop(); await f.start(); await f.post('重启后的消息');
  assert.deepEqual(f.requests.at(-1).body.messages.slice(0, previous.length), previous);
  events = await f.events(); assertUsage(events, f.requests, [firstFailure]); oneEnding(events); presentation(f.requests, events);
});

test('D20/D6: persistent consolidation failure is bounded, recorded, searchable and resumes after skipped batch', async t => {
  const f = await fixture(t, { YUVI_CONTEXT_EVENTS: '10', YUVI_OWNER_NAME: '小林' });
  f.consolidation.push((res, r) => { r.failed = true; res.writeHead(500); res.end(key); });
  for (let i = 0; i < 15; i++) {
    assert.match(await f.post(`积压消息-${i}`), /event: done/);
    const events = await f.events(), current = state(events.slice(0, -2), 10);
    assert.ok(current.raw.length <= 21);
  }
  let events = await f.events(); const skipped = events.filter(e => e.kind === 'unconsolidated');
  assert.equal(skipped.length, 1); assert.equal(skipped[0].meta.reason, 'backlog');
  const dialogue = events.filter(e => ['heard', 'said'].includes(e.kind));
  assert.deepEqual(skipped[0].meta.material, { from_seq: dialogue[0].seq, through_seq: dialogue[9].seq });
  const failure = f.requests.find(r => r.failed);
  assert.equal(f.requests.filter(r => !r.body.tools).length, 1);
  assert.equal(events.filter(e => e.kind === 'wrote').length, 0);
  await delay(Math.max(0, failure.time + 30_100 - Date.now()));
  f.dialogue.push((res, r) => res.end(tools(['check', { query: '积压消息-0' }]) + end(r.usage)));
  await f.post('恢复并查阅');
  events = await f.events(); const wrote = events.find(e => e.kind === 'wrote');
  assert.equal(wrote.meta.material.from_seq, dialogue[10].seq);
  assert.ok(f.requests.at(-1).body.messages.find(m => m.role === 'tool').content.includes('积压消息-0'));
  assertUsage(events, f.requests, [failure]); oneEnding(events); presentation(f.requests, events);
});

test('D19: four real consolidations preserve whole writings and select by character budget', async t => {
  const f = await fixture(t, { YUVI_CONSOLIDATION_IDLE_MS: '100', YUVI_CONTEXT_WRITING_CHARS: '100', YUVI_OWNER_NAME: '小林' });
  const contents = ['甲'.repeat(60), '乙'.repeat(30), '丙'.repeat(150), '丁'.repeat(20)];
  for (let i = 0; i < 4; i++) {
    f.consolidation.push((res, r) => res.end(text(contents[i]) + end(r.usage, i === 2 ? 'length' : 'stop')));
    await f.post('预算材料' + i);
    await waitFor(async () => (await f.events()).filter(e => e.kind === 'wrote').length === i + 1);
  }
  // Trigger a request with the fourth selection, followed by a check of omitted writings.
  f.dialogue.push((res, r) => res.end(tools(['check', {}]) + end(r.usage)));
  await f.post('预算核对');
  const events = await f.events(), wrote = events.filter(e => e.kind === 'wrote');
  assert.equal(wrote[2].content, contents[2]); assert.equal(wrote[2].meta.finish_reason, 'length');
  const expected = [[], [0], [0, 1], [2], [3]];
  let completed = 0;
  for (const req of f.requests) {
    // A consolidation sees writings from previous calls, then publishes its own result.
    if (!req.body.messages.some(m => m.role === 'tool')) {
      const present = contents.flatMap((content, i) => req.body.messages.some(m => m.content.includes(content)) ? [i] : []);
      assert.deepEqual(present, expected[completed]);
      if (completed === 3) assert.ok(req.body.messages.some(m => m.content.includes('因长度上限停止')));
    }
    if (!req.body.tools) completed++;
  }
  const result = f.requests.at(-1).body.messages.find(m => m.role === 'tool').content;
  for (const content of contents) assert.ok(result.includes(content));
  presentation(f.requests, events); oneEnding(events);
});

for (const partial of [false, true]) test(`D11(e)/D13: SIGKILL during second step (${partial ? 'unknown' : 'not_sent'})`, async t => {
  const f = await fixture(t, { YUVI_CONSOLIDATION_IDLE_MS: '100' });
  f.dialogue.push((res, r) => res.end((partial ? text('已推出') : '') + tools(['check', {}]) + end(r.usage)), res => { res.flushHeaders(); });
  const response = await fetch(f.url + '/api/messages', { method: 'POST', body: JSON.stringify({ text: '第二步挂起' }) });
  const read = response.text().catch(() => '');
  await waitFor(() => f.requests.length === 2);
  await delay(250); assert.equal(f.requests.length, 2);
  await f.stop('SIGKILL'); await read;
  await f.start();
  const events = await f.events(), error = events.at(-1);
  assert.equal(error.kind, 'error'); assert.equal(error.meta.reason, 'interrupted');
  assert.equal(error.meta.outcome, partial ? 'unknown' : 'not_sent');
  oneEnding(events); assert.equal(events.filter(e => e.kind === 'checked').length, 1);
  // Immediately stop; an independently scheduled later consolidation is allowed.
  assert.equal(f.requests.filter(r => r.body.tools).length, 2);
});

test('D5/D6: interrupted consolidation writes nothing and retries the same material on restart', async t => {
  const f = await fixture(t, { YUVI_CONSOLIDATION_IDLE_MS: '100' });
  f.consolidation.push(res => { res.write(text('尚未完成的文字')); });
  await f.post('待整理材料'); await waitFor(() => f.requests.length === 2);
  const original = await f.events(); assert.ok(!original.some(e => e.kind === 'wrote'));
  await f.stop('SIGKILL'); await f.start();
  await waitFor(async () => (await f.events()).some(e => e.kind === 'wrote'));
  const events = await f.events(); assert.equal(events.filter(e => e.kind === 'wrote').length, 1);
  assert.deepEqual(events.at(-1).meta.material, { from_seq: original[0].seq, through_seq: original.findLast(e => e.kind === 'said').seq });
});

test('D15: all new numeric configuration bounds and blank owner fail safely', async t => {
  const f = await fixture(t); await f.stop();
  const cases = ['YUVI_CONTEXT_WRITING_CHARS', 'YUVI_CONSOLIDATION_MAX_TOKENS', 'YUVI_CONSOLIDATION_IDLE_MS']
    .flatMap(name => ['0', '-1', '1.5', '2147483648'].map(value => [name, value]));
  cases.push(['YUVI_OWNER_NAME', '  ']);
  for (const [name, value] of cases) {
    const child = spawn(process.execPath, ['dist/main.js'], { env: { ...f.env, [name]: value }, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = ''; child.stdout.on('data', d => output += d); child.stderr.on('data', d => output += d);
    const [code] = await once(child, 'exit'); assert.notEqual(code, 0); assert.ok(output.includes(name)); assert.ok(!output.includes(key));
    assert.ok(!output.includes('Invalid configuration: ' + name + '='));
  }
});

test('check limits, exact case-sensitive substring, calendar dates, whole oversized newest match', () => {
  const events = Array.from({ length: 45 }, (_, i) => ({ seq: i + 1, id: 'test-' + i, branch: 'dev:v2-dev', scene: 'web',
    class: 'experience', kind: 'heard', t_recorded: Date.parse('2026-10-21T00:00:00Z') + i, content: 'Ab 猫 ' + i, meta: {} }));
  let result = check(events, '{}', '小林');
  assert.equal(result.meta.total, 45); assert.equal(result.meta.result_seqs.length, 40);
  assert.equal(check(events, '{"query":"ab"}', '小林').meta.total, 0);
  assert.equal(check(events, '{"query":"Ab 猫"}', '小林').meta.total, 45);
  for (const from of ['bad', '2026-02-29', '2026-01-01T25:00:00', '2026-00-10']) assert.equal(check(events, JSON.stringify({ from }), '小林').meta.invalid, true);
  assert.deepEqual(check(events, '{"from":"2026-10-21T08:00:00","to":"2026-10-21T08:00:00"}', '小林').meta.result_seqs, [1]);
  assert.equal(check(events, '{"from":"2026-10-21"}', '小林').meta.total, 45);
  let queried = false;
  assert.equal(check(() => { queried = true; return events; }, '{"from":"bad"}', '小林').meta.invalid, true);
  assert.equal(queried, false);
  assert.throws(() => check(() => { throw new Error('archive read failed'); }, '{}', '小林'), /archive read failed/);
  events.at(-1).content = '猫'.repeat(16001);
  result = check(events, '{}', '小林'); assert.deepEqual(result.meta.result_seqs, [45]); assert.ok(result.content.includes(events.at(-1).content));
  events[43].content = 'b'.repeat(15999); events[44].content = 'c'.repeat(10);
  assert.deepEqual(check(events, '{}', '小林').meta.result_seqs, [45]);
  // Nonempty writings alone qualify; attempts/control do not.
  const wrote = { ...events[0], class: 'inner', kind: 'wrote', content: '整条', seq: 100 };
  assert.deepEqual(check([wrote, { ...wrote, id: 'writing-101', seq: 101, content: '' }, { ...wrote, id: 'writing-102', seq: 102, kind: 'reply_attempt', class: 'act' }], '{}', '小林').meta.result_seqs, [100]);
  assert.deepEqual(writings([wrote, { ...wrote, id: 'writing-101', seq: 101, content: 'a'.repeat(150) }, { ...wrote, id: 'writing-102', seq: 102, content: 'b'.repeat(20) }], 100).map(e => e.seq), [102]);
});

test('D2/D17: actual P3 executable archive and snapshots remain compatible; restored coverage prevents repetition', async t => {
  const f = await fixture(t); await f.stop();
  const legacy = join(f.root, 'legacy');
  await import('node:fs/promises').then(fs => fs.mkdir(legacy));
  const tar = execFileSync('git', ['archive', 'e74d2f1']);
  execFileSync('tar', ['-x', '-C', legacy], { input: tar });
  await import('node:fs/promises').then(fs => fs.symlink(resolve('node_modules'), join(legacy, 'node_modules'), 'dir'));
  execFileSync(process.execPath, [resolve('node_modules/typescript/bin/tsc'), '-p', join(legacy, 'tsconfig.json')]);
  const legacyData = join(f.root, 'legacy-data');
  const code = `import { Archive } from ${JSON.stringify('file://' + join(legacy, 'dist/archive.js'))};
    import { createSnapshot, restoreSnapshot } from ${JSON.stringify('file://' + join(legacy, 'dist/snapshots.js'))};
    const a = new Archive(process.argv[1]);
    for (const kind of ['said','silent','error']) {
      const h = a.append({class:'experience',kind:'heard',actor:'owner',content:'旧消息-'+kind});
      a.append({class:kind==='error'?'control':'act',kind,actor:kind==='error'?'system':'yuvi',reply_to:h.id,content:kind==='said'?'旧回复':'',meta:kind==='error'?{reason:'model_failure',outcome:'not_sent'}:{}});
    }
    const file = createSnapshot({dataDir:process.argv[1],snapshotDir:process.argv[1]+'-snapshots'});
    restoreSnapshot(file, process.argv[2]); a.close(); console.log(file);`;
  const oldSnapshot = execFileSync(process.execPath, ['--input-type=module', '-e', code, legacyData, f.dataDir + '-restored'], { encoding: 'utf8' }).trim();
  // Use the restored directory so that all four historical event kinds are present.
  f.env.YUVI_DATA_DIR = f.dataDir + '-restored';
  function rows() {
    const db = new DatabaseSync(join(f.env.YUVI_DATA_DIR, 'archive.sqlite'), { readOnly: true });
    try { return { events: db.prepare('SELECT * FROM events ORDER BY seq').all(), schema: db.prepare('SELECT type,name,tbl_name,sql FROM sqlite_master ORDER BY name').all() }; }
    finally { db.close(); }
  }
  const before = rows();
  await f.start(); await f.post('P4 使用旧档案');
  const after = rows(); assert.deepEqual(after.events.slice(0, before.events.length), before.events); assert.deepEqual(after.schema, before.schema);
  assert.equal(after.events.at(-1).kind, 'said'); verifySnapshot(oldSnapshot);
  const snapshot = createSnapshot({ dataDir: f.env.YUVI_DATA_DIR, snapshotDir: join(f.root, 'p4-snapshots') }); verifySnapshot(snapshot);
  // Consolidate, snapshot while live, restore and confirm the durable coverage cursor survives.
  await f.stop(); f.env.YUVI_CONSOLIDATION_IDLE_MS = '100'; await f.start();
  await waitFor(async () => (await f.events()).some(e => e.kind === 'wrote'));
  const coveredEvents = await f.events(), covered = state(coveredEvents, 200).covered;
  const coveredSnapshot = createSnapshot({ dataDir: f.env.YUVI_DATA_DIR, snapshotDir: join(f.root, 'covered-snapshots') });
  const target = join(f.root, 'covered-restored'); restoreSnapshot(coveredSnapshot, target);
  await f.stop(); f.env.YUVI_DATA_DIR = target;
  const calls = f.requests.length; await f.start(); await delay(350);
  assert.equal(state(await f.events(), 200).covered, covered); assert.equal(f.requests.length, calls);
  await f.post('恢复后新经历'); await waitFor(async () => (await f.events()).filter(e => e.kind === 'wrote').length > coveredEvents.filter(e => e.kind === 'wrote').length);
  assert.ok((await f.events()).findLast(e => e.kind === 'wrote').meta.material.from_seq > covered);
});

test('consolidation timeout discards partial text and usage, leaves materials pending, dialogue continues during backoff', async t => {
  const f = await fixture(t, { YUVI_CONSOLIDATION_IDLE_MS: '50', YUVI_MODEL_IDLE_TIMEOUT_MS: '150' });
  f.consolidation.push((res, r) => { res.write(text('未完成整理') + frame({ choices: [], usage: r.usage })); });
  await f.post('超时材料');
  await waitFor(() => f.output.includes('Consolidation failed; retry deferred.'));
  const before = await f.events(); assert.deepEqual(before.map(e => e.kind), ['heard', 'presented', 'reply_attempt', 'said', 'presented']);
  assert.equal(state(before, 200).covered, 0);
  await f.post('退避中继续'); assert.equal((await f.events()).at(-1).kind, 'said');
  await delay(200); assert.equal(f.requests.filter(r => !r.body.tools).length, 1);
});

test('fragmented check identifiers/arguments round-trip; text on step four wins and records ignored check', async t => {
  const f = await fixture(t);
  f.dialogue.push((res, r) => res.end(frame({ choices: [{ delta: { tool_calls: [{ index: 0, id: 'frag', function: { name: 'ch', arguments: '{"query":' } }] } }] }) +
    frame({ choices: [{ delta: { tool_calls: [{ index: 0, id: '-id', function: { name: 'eck', arguments: '"片段"}' } }] } }] }) + end(r.usage)));
  for (let i = 0; i < 2; i++) f.dialogue.push((res, r) => res.end(tools(['check', {}]) + end(r.usage)));
  f.dialogue.push((res, r) => res.end(text('第四步文本') + tools(['check', {}]) + end(r.usage)));
  await f.post('工具片段');
  assert.equal(f.requests.length, 4);
  const second = f.requests[1].body.messages;
  assert.equal(second.find(m => m.tool_calls).tool_calls[0].id, 'frag-id');
  assert.equal(second.find(m => m.role === 'tool').tool_call_id, 'frag-id');
  const events = await f.events(); assert.equal(events.filter(e => e.kind === 'checked').length, 3);
  assert.equal(events.at(-1).content, '第四步文本'); assert.deepEqual(events.at(-1).meta.ignored_tools, ['check']);
  assertUsage(events, f.requests); oneEnding(events);
});
