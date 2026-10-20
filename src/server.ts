import { createServer, type ServerResponse, type IncomingMessage } from 'node:http';
import { Archive, type Event } from './archive.js';
import type { Config } from './config.js';
import { streamModel, silenceReason, type Message, type Usage, type ToolCall } from './model.js';
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
export function createApp(config: Config) {
  const archive = new Archive(config.dataDir);
  archive.recover();
  let queue = Promise.resolve();
  let received = Promise.resolve();
  let failed = false;
  async function turn(heard: Event, res: ServerResponse): Promise<void> {
    const messages: Message[] = [{ role: 'system', content: config.persona },
      ...archive.context(config.contextEvents).map(event => ({
        role: (event.kind === 'said' ? 'assistant' : 'user') as 'user' | 'assistant',
        content: event.kind === 'silent'
          ? `档案记录：YUVI 对 heard id=${event.reply_to} 没有回复（silent id=${event.id}，seq=${event.seq}）。`
          : `档案事件 id=${event.id}，seq=${event.seq}，actor=${event.actor}，t_recorded=${event.t_recorded}，reply_to=${event.reply_to ?? 'unknown'}\n${event.content}`
      })),
      { role: 'user', content: `当前回合回应的消息：heard id=${heard.id}，seq=${heard.seq}，actor=${heard.actor}，t_recorded=${heard.t_recorded}。原文：\n${heard.content}` }];
    let attempt: Event | undefined, content = '', sentContent = '';
    let archiveFailed = false;
    let usage: Usage | undefined, tools: ToolCall[] = [], reason: string | undefined;
    const usageMeta = () => usage === undefined ? {} : { usage };
    try {
      tools = await streamModel(config, messages, text => {
        if (!attempt) {
          try { attempt = archive.append({ class: 'act', kind: 'reply_attempt',
            actor: 'yuvi', reply_to: heard.id, model: config.model }); }
          catch { archiveFailed = true; throw new Error('archive failure'); }
        }
        if (sse(res, 'delta', { text })) sentContent += text;
        content += text;
      }, value => { usage = value; });
      if (!content && tools.length) reason = silenceReason(tools);
    } catch {
      if (archiveFailed) throw new Error('archive failure');
      archive.append({ class: 'control', kind: 'error', actor: 'system', reply_to: heard.id,
        content: sentContent, meta: { outcome: attempt ? 'partial' : 'not_sent', reason: 'model_failure',
          ...(attempt ? { attempt: attempt.id } : {}), ...usageMeta() } });
      sse(res, 'error', { message: 'Model request failed or timed out.' });
      res.end(); return;
    }
    if (reason !== undefined) {
      const silent = archive.append({ class: 'act', kind: 'silent', actor: 'yuvi',
        reply_to: heard.id, content: reason, model: config.model, meta: usageMeta() });
      sse(res, 'silent', silent.id); res.end(); return;
    }
    // An empty successful stream has no first delta; still record the sending attempt
    // before completing the reply, preserving said -> attempt references.
    if (!attempt) attempt = archive.append({ class: 'act', kind: 'reply_attempt',
      actor: 'yuvi', reply_to: heard.id, model: config.model });
    const said = archive.append({ class: 'act', kind: 'said', actor: 'yuvi',
      reply_to: heard.id, content, model: config.model, meta: { attempt: attempt.id, ...usageMeta(),
        ...(tools.length ? { ignored_tools: tools.map(tool => tool.name) } : {}) } });
    sse(res, 'done', said.id); res.end();
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
      const text = readText(req);
      // Persist accepted messages even while an earlier generation is running.
      // Separate receipt from generation so body completion cannot reorder arrivals.
      received = received.then(async () => {
        if (failed) { res.destroy(); return; }
        const value = await text;
        if (value === null) { json(res, 400, { message: 'Expected nonempty text' }); return; }
        const heard = archive.append({ class: 'experience', kind: 'heard', actor: 'owner', content: value });
        res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no' });
        res.flushHeaders();
        sse(res, 'heard', heard.id);
        queue = queue.then(async () => {
          if (!failed) await turn(heard, res);
        }).catch(fatal);
      }).catch(fatal);
      function fatal(): void {
        failed = true;
        // Leave unfinished heard events for startup recovery after a storage failure.
        server.close(); server.closeAllConnections();
        console.error('Archive or request processing failed; restart required.');
        process.exitCode = 1;
      }
      return;
    }
    json(res, 404, { message: 'Not found' });
  });
  return { server, archive, idle: async () => { await received; await queue; } };
}
