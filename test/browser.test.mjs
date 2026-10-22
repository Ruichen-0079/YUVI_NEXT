import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import { createApp } from '../dist/server.js';

test('A12/B2: Chromium streams text, shows neutral silence, and reloads history',
  { skip: !process.env.YUVI_CHROMIUM && 'Set YUVI_CHROMIUM to run browser acceptance' }, async t => {
  assert.ok(process.env.YUVI_CHROMIUM, 'Set YUVI_CHROMIUM to the installed Chromium executable');
  const dir = await mkdtemp(join(tmpdir(), 'yuvi-browser-'));
  let finish;
  const barrier = new Promise(resolve => { finish = resolve; });
  let calls = 0;
  const model = createServer(async (req, res) => {
    for await (const chunk of req) { /* consume request */ }
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    if (++calls > 1) {
      res.end('data: '+JSON.stringify({ choices: [{ delta: { tool_calls: [{ index: 0, function: { name: 'stay_silent', arguments: '{"reason":"先不说"}' } }] } }] })+'\n\ndata: [DONE]\n\n');
      return;
    }
    res.write('data: {"choices":[{"delta":{"content":"我在"}}]}\n\n');
    await barrier;
    res.end('data: {"choices":[{"delta":{"content":"。"}}]}\n\ndata: [DONE]\n\n');
  });
  model.listen(0, '127.0.0.1'); await once(model, 'listening');
  const app = createApp({ dataDir: dir, persona: 'test', baseUrl: `http://127.0.0.1:${model.address().port}/v1`,
    apiKey: 'fake', model: 'fake', contextEvents: 200, host: '127.0.0.1', port: 8787 });
  app.server.listen(0, '127.0.0.1'); await once(app.server, 'listening');
  let browser;
  t.after(async () => {
    finish(); await browser?.close(); await app.idle();
    await new Promise(resolve => app.server.close(resolve)); app.archive.close();
    await new Promise(resolve => model.close(resolve)); await rm(dir, { recursive: true, force: true });
  });
  browser = await chromium.launch({ executablePath: process.env.YUVI_CHROMIUM, headless: true,
    args: ['--no-sandbox', '--disable-background-networking'] });
  const page = await browser.newPage(); const errors = []; page.on('pageerror', error => errors.push(error));
  await page.goto(`http://127.0.0.1:${app.server.address().port}`);
  await page.locator('#text').fill('你好 <script>原文</script>'); await page.locator('button').click();
  await page.waitForFunction(() => document.querySelector('#conversation').textContent.includes('yuvi: 我在'));
  assert.equal(app.archive.events().at(-1).kind, 'reply_attempt');
  assert.equal(await page.locator('#conversation p').last().textContent(), 'yuvi: 我在');
  finish(); await page.waitForFunction(() => document.querySelector('#status').textContent === '');
  assert.equal(await page.locator('#conversation p').last().textContent(), 'yuvi: 我在。');
  await page.reload(); await page.waitForFunction(() => document.querySelector('#conversation').textContent.includes('我在。'));
  assert.match(await page.locator('#conversation').textContent(), /你好 <script>原文<\/script>/);
  await page.locator('#text').fill('沉默回合'); await page.locator('button').click();
  await page.waitForFunction(() => document.querySelector('#conversation').textContent.includes('（没有回复）'));
  assert.equal(await page.locator('#conversation p').last().textContent(), 'yuvi: （没有回复）');
  assert.ok(!(await page.locator('body').textContent()).includes('先不说'));
  for (const [cls, kind] of [['inner', 'wrote'], ['act', 'checked'], ['control', 'unconsolidated']]) {
    app.archive.append({ class: cls, kind, actor: cls === 'control' ? 'system' : 'yuvi', content: 'P4-hidden-' + kind });
  }
  await page.reload();
  await page.waitForFunction(() => document.querySelector('#conversation').textContent.includes('（没有回复）'));
  assert.ok(!(await page.locator('body').textContent()).includes('先不说'));
  assert.ok(!(await page.locator('body').textContent()).includes('P4-hidden-'));
  assert.equal(app.archive.events().filter(e => e.kind === 'presented').length, 2);
  assert.ok(!(await page.locator('body').textContent()).includes('messages_sha256'));
  assert.ok(!(await page.locator('body').textContent()).includes('presented'));
  assert.deepEqual(errors, []);
});
