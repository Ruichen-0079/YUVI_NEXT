// Feasibility: in-process createApp under node:test mock timers, fake model over loopback,
import { writeSync } from 'node:fs'; const L = (...a) => writeSync(2, a.map(String).join(' ') + '\n');
// consolidation triggered by the service's own idle interval after simulated hours.
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const dist = process.env.DIST;
const { createApp } = await import(join(dist, 'server.js'));
const { Archive } = await import(join(dist, 'archive.js'));
const frame = v => `data: ${JSON.stringify(v)}\n\n`;
test('simulated weeks with real idle consolidation', async () => {
  const model = createServer(async (req, res) => {
    let raw = ''; for await (const c of req) raw += c; const body = JSON.parse(raw);
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    res.end(frame({ choices: [{ delta: { content: body.tools ? '嗯。' : '写下：' + body.messages.length } }] }) +
      frame({ choices: [{ delta: {}, finish_reason: 'stop' }], usage: { prompt_tokens: 1, completion_tokens: 1 } }) + 'data: [DONE]\n\n');
  });
  model.listen(0, '127.0.0.1'); await once(model, 'listening');
  const dir = mkdtempSync(join(tmpdir(), 'p8clock-')); const persona = join(dir, 'p.txt'); writeFileSync(persona, '人设');
  mock.timers.enable({ apis: ['Date', 'setInterval', 'setTimeout'], now: Date.parse('2026-11-02T00:00:00Z') });
  const config = { model: 'fake', baseUrl: `http://127.0.0.1:${model.address().port}/v1`, apiKey: 'k', dataDir: join(dir, 'data'),
    persona: '人设', personaFile: persona, ownerName: '小林', writingChars: 4000, consolidationMaxTokens: 400,
    consolidationIdleMs: 3_600_000, snapshotIntervalMs: 86_400_000, idleTimeoutMs: 60_000, maxDurationMs: 600_000,
    host: '127.0.0.1', port: 0, contextEvents: 20 };
  const archive = new Archive(config.dataDir);
  const app = createApp(config, archive);
  app.server.listen(0, '127.0.0.1'); await once(app.server, 'listening');
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const t0 = performance.now(); let turns = 0;
  for (let day = 0; day < 56; day++) {
    for (let k = 0; k < 20; k++) {
      const res = await fetch(base + '/api/messages', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: `第${day}天第${k}句` }) });
      await res.text(); turns++;
      mock.timers.tick(5 * 60_000);
    }
    for (let h = 0; h < 14; h++) { mock.timers.tick(3_600_000); await app.idle(); await new Promise(r => setImmediate(r)); }
    await app.idle();
  }
  const kinds = archive.db.prepare('SELECT kind, count(*) n FROM events GROUP BY kind').all();
  L(JSON.stringify({ turns, wallMs: Math.round(performance.now() - t0), kinds, last: new Date(Date.now()).toISOString() }));
  assert.ok(kinds.find(k => k.kind === 'wrote')?.n > 0);
  mock.timers.reset(); app.server.close(); model.close(); archive.close();
});
