import { createServer, type ServerResponse, type IncomingMessage } from 'node:http';
import { Archive, type Event } from './archive.js';
import type { Config } from './config.js';
import { streamModel, silenceReason, type Message, type Usage, ModelFailure } from './model.js';
import { state, dialogueMessages, consolidationMessages, check } from './context.js';
import { page } from './page.js';

async function readText(req: IncomingMessage): Promise<string | null> {
  try {
    const chunks: Buffer[] = []; let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 1_048_576) return null;
      chunks.push(Buffer.from(chunk));
    }
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    return typeof body?.text === 'string' && body.text.trim() ? body.text : null;
  } catch { return null; }
}
function json(res: ServerResponse, code: number, value: unknown): void {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(value));
}
function sse(res: ServerResponse, kind: string, value: unknown): boolean {
  if (res.destroyed || res.writableEnded) return false;
  res.write(`event: ${kind}\ndata: ${typeof value === 'string' ? value : JSON.stringify(value)}\n\n`);
  return true;
}
export function createApp(config: Config, archive = new Archive(config.dataDir)) {
  archive.recover();
  let queue = Promise.resolve();
  let received = Promise.resolve();
  let failed = false;
  let pendingTurns = 0, receiving = 0, consolidating = false;
  let retryAfter = 0;
  const range = (material: Event[]) => ({ from_seq: material[0].seq, through_seq: material.at(-1)!.seq });
  async function consolidate(): Promise<boolean> {
    const events = archive.events();
    const material = state(events, config.contextEvents).materials.slice(0, config.contextEvents);
    if (!material.length || Date.now() < retryAfter) return false;
    let content = '', usage: Usage | undefined, finish: unknown;
    try {
      await streamModel(config, consolidationMessages(events, material, config), text => { content += text; },
        value => { usage = value; }, { mode: 'consolidation', maxTokens: config.consolidationMaxTokens ?? 4000,
          finish: value => { finish = value; } });
    } catch (error) {
      retryAfter = Date.now() + 30_000;
      console.error('Consolidation failed; retry deferred.' +
        (error instanceof ModelFailure && error.httpStatus !== undefined ? ` HTTP ${error.httpStatus}.` : ''));
      return false;
    }
    // Storage failures are fatal, rather than being mistaken for model failures.
    archive.append({ class: 'inner', kind: 'wrote', actor: 'yuvi', model: config.model, content,
      meta: { material: range(material), ...(finish === undefined ? {} : { finish_reason: finish }),
        ...(usage === undefined ? {} : { usage }) } });
    retryAfter = 0;
    return true;
  }
  async function pressure(): Promise<void> {
    let current = state(archive.events(), config.contextEvents);
    while (current.materials.length > 2 * config.contextEvents) {
      const material = current.materials.slice(0, config.contextEvents);
      archive.append({ class: 'control', kind: 'unconsolidated', actor: 'system',
        meta: { material: range(material), reason: 'backlog' } });
      current = state(archive.events(), config.contextEvents);
    }
    while (current.pressure && await consolidate()) current = state(archive.events(), config.contextEvents);
  }
  async function turn(heard: Event, res: ServerResponse): Promise<void> {
    await pressure();
    const messages: Message[] = dialogueMessages(archive.events(), heard, config);
    let attempt: Event | undefined, content = '', sentContent = '';
    let archiveFailed = false, usage: Usage | undefined;
    const append = (input: Parameters<Archive['append']>[0]) => {
      try { return archive.append(input); }
      catch { archiveFailed = true; throw new Error('archive failure'); }
    };
    const ignored: string[] = [];
    const usageMeta = () => usage === undefined ? {} : { usage };
    try {
      for (let step = 0; step < 4; step++) {
        usage = undefined;
        let stepContent = '';
        const tools = await streamModel(config, messages, text => {
          if (!attempt) {
            attempt = append({ class: 'act', kind: 'reply_attempt',
              actor: 'yuvi', reply_to: heard.id, model: config.model });
          }
          if (sse(res, 'delta', { text })) sentContent += text;
          content += text; stepContent += text;
        }, value => { usage = value; }, { lastStep: step === 3 });
        const checks = tools.filter(t => t.name === 'check');
        if (checks.length && step < 3) {
          let recordedUsage = false;
          const replies = tools.map(tool => {
            if (tool.name !== 'check') {
              ignored.push(tool.name);
              return '本步继续查阅；这个调用没有作为回合结局。';
            }
            const result = check(() => archive.events(), tool.arguments, config.ownerName ?? '负责人');
            append({ class: 'act', kind: 'checked', actor: 'yuvi', model: config.model,
              reply_to: heard.id, meta: { ...result.meta, ...(!recordedUsage ? usageMeta() : {}) } });
            recordedUsage = true;
            return result.content;
          });
          messages.push({ role: 'assistant', content: stepContent, tool_calls: tools.map((tool, index) => ({
            id: tool.id || `call_${step}_${index}`, type: 'function', function: { name: tool.name, arguments: tool.arguments }
          })) });
          tools.forEach((tool, index) => messages.push({ role: 'tool', tool_call_id: tool.id || `call_${step}_${index}`, content: replies[index] }));
          usage = undefined;
          continue;
        }
        if (!content) {
          const reason = silenceReason(tools);
          const silent = append({ class: 'act', kind: 'silent', actor: 'yuvi',
            reply_to: heard.id, content: reason, model: config.model, meta: usageMeta() });
          sse(res, 'silent', silent.id); res.end(); return;
        }
        ignored.push(...tools.map(tool => tool.name));
        break;
      }
    } catch (error) {
      if (archiveFailed) throw new Error('archive failure');
      append({ class: 'control', kind: 'error', actor: 'system', reply_to: heard.id,
        content: sentContent, meta: { outcome: attempt ? 'partial' : 'not_sent', reason: 'model_failure',
          request_chars: messages.reduce((sum, message) => sum + message.content.length, 0),
          ...(error instanceof ModelFailure && error.httpStatus !== undefined ? { http_status: error.httpStatus } : {}),
          ...(attempt ? { attempt: attempt.id } : {}), ...usageMeta() } });
      sse(res, 'error', { message: 'Model request failed or timed out.' });
      res.end(); return;
    }
    const said = append({ class: 'act', kind: 'said', actor: 'yuvi',
      reply_to: heard.id, content, model: config.model, meta: { attempt: attempt!.id, ...usageMeta(),
        ...(ignored.length ? { ignored_tools: ignored } : {}) } });
    sse(res, 'done', said.id); res.end();
  }
  function fatal(): void {
    failed = true;
    server.close(); server.closeAllConnections();
    console.error('Archive or request processing failed; restart required.');
    process.exitCode = 1;
  }
  const server = createServer((req, res) => {
    // A disconnected browser never cancels generation or causes an automatic retry.
    res.on('error', () => {});
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (req.method === 'GET' && url.pathname === '/health') return json(res, 200, { ok: true });
    if (req.method === 'GET' && url.pathname === '/api/usage') return json(res, 200, archive.usage());
    if (req.method === 'GET' && url.pathname === '/api/events') {
      const raw = url.searchParams.get('after') ?? '0'; const after = Number(raw);
      if (!/^\d+$/.test(raw) || !Number.isSafeInteger(after)) return json(res, 400, { message: 'Invalid after' });
      return json(res, 200, archive.events(after));
    }
    if (req.method === 'GET' && url.pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end(page);
    }
    if (req.method === 'POST' && url.pathname === '/api/messages') {
      receiving++;
      const text = readText(req);
      // Persist accepted messages even while an earlier generation is running.
      // Separate receipt from generation so body completion cannot reorder arrivals.
      received = received.then(async () => {
        if (failed) { res.destroy(); return; }
        const value = await text;
        receiving--;
        if (value === null) { json(res, 400, { message: 'Expected nonempty text' }); return; }
        const heard = archive.append({ class: 'experience', kind: 'heard', actor: 'owner', content: value });
        res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no' });
        res.flushHeaders();
        sse(res, 'heard', heard.id);
        pendingTurns++;
        queue = queue.then(async () => {
          try { if (!failed) await turn(heard, res); }
          finally { pendingTurns--; }
        }).catch(fatal);
      }).catch(fatal);
      return;
    }
    json(res, 404, { message: 'Not found' });
  });
  // One lightweight timer only enqueues work; model calls always use the dialogue queue.
  const timer = setInterval(() => {
    if (failed || receiving || pendingTurns || consolidating || Date.now() < retryAfter) return;
    const current = state(archive.events(), config.contextEvents);
    const last = current.dialogue.at(-1);
    if (!last || !current.materials.length || Date.now() - last.t_recorded < (config.consolidationIdleMs ?? 3_600_000)) return;
    consolidating = true;
    queue = queue.then(async () => {
      // A receipt may have arrived after this work was enqueued.
      while (!failed && !receiving && !pendingTurns && await consolidate()) { /* ordered batches */ }
    }).catch(fatal).finally(() => { consolidating = false; });
  }, Math.min(1000, config.consolidationIdleMs ?? 3_600_000));
  timer.unref();
  server.on('close', () => clearInterval(timer));
  return { server, archive, idle: async () => { await received; await queue; } };
}
