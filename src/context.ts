import type { Event } from './archive.js';
import type { Config } from './config.js';
import type { Message } from './model.js';

export const isDialogue = (e: Event) => (e.class === 'experience' && e.kind === 'heard') ||
  (e.class === 'act' && ['said', 'silent'].includes(e.kind));
export function state(events: Event[], n: number) {
  const scene = events.filter(e => e.scene === 'web' && e.branch === 'dev:v2-dev');
  const dialogue = scene.filter(isDialogue);
  const covered = scene.reduce((c, e) => {
    if (!((e.class === 'inner' && e.kind === 'wrote') || (e.class === 'control' && e.kind === 'unconsolidated'))) return c;
    const material = e.meta.material as { through_seq?: number } | undefined;
    return Math.max(c, material?.through_seq ?? 0);
  }, 0);
  const ended = new Set(scene.filter(e => e.reply_to &&
    ((e.class === 'act' && ['said', 'silent'].includes(e.kind)) || (e.class === 'control' && e.kind === 'error'))).map(e => e.reply_to));
  const firstPending = dialogue.find(e => e.kind === 'heard' && !ended.has(e.id))?.seq ?? Infinity;
  const materials = dialogue.filter(e => e.seq > covered && e.seq < firstPending);
  const pending = dialogue.filter(e => e.seq > covered);
  // Full-window steps minimize prefix changes; each successful step is >= ceil(N/2).
  const stride = n;
  const desiredStart = Math.max(0, Math.ceil((dialogue.length - n) / stride) * stride);
  const coveredCount = dialogue.length - pending.length;
  return { dialogue, covered, materials, pending,
    raw: dialogue.slice(Math.min(desiredStart, coveredCount)),
    pressure: desiredStart > coveredCount };
}
export function localTime(ms: number): string {
  const d = new Date(ms), pad = (n: number) => String(n).padStart(2, '0');
  const offset = -d.getTimezoneOffset();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}（UTC${offset < 0 ? '-' : '+'}${pad(Math.floor(Math.abs(offset) / 60))}:${pad(Math.abs(offset) % 60)}）`;
}
export function record(e: Event, owner: string, includeReason = false): string {
  const time = localTime(e.t_recorded);
  if (e.kind === 'heard') return `${time} ${owner}说：\n${e.content}`;
  if (e.kind === 'said') return `${time} 你说：\n${e.content}`;
  if (e.kind === 'silent') return `${time} 你没有回复。${includeReason && e.content ? '\n当时给出的理由：\n' + e.content : ''}`;
  return `${time} 你写下的文字${e.meta.finish_reason === 'length' ? '（因长度上限停止）' : ''}：\n${e.content}`;
}
export function writings(events: Event[], budget: number): Event[] {
  const selected: Event[] = []; let chars = 0;
  for (const e of events.filter(e => e.branch === 'dev:v2-dev' && e.scene === 'web' && e.class === 'inner' && e.kind === 'wrote' && e.content !== '').reverse()) {
    if (selected.length && chars + e.content.length > budget) break;
    selected.push(e); chars += e.content.length;
  }
  return selected.reverse();
}
export function prefix(events: Event[], config: Config): Message[] {
  return [{ role: 'system', content: config.persona },
    ...writings(events, config.writingChars ?? 16000).map(e => ({ role: 'user' as const, content: record(e, config.ownerName ?? '负责人') }))];
}
export function dialogueMessages(events: Event[], heard: Event, config: Config): Message[] {
  return [...prefix(events, config), ...state(events, config.contextEvents).raw.map(e => ({
    role: e.kind === 'said' ? 'assistant' as const : 'user' as const,
    content: e.kind === 'said' ? e.content : record(e, config.ownerName ?? '负责人')
  })), { role: 'user', content: `现在是${localTime(Date.now())}。当前回应的是${config.ownerName ?? '负责人'}在${localTime(heard.t_recorded)}说的这一句：\n${heard.content}` }];
}
export function consolidationMessages(events: Event[], material: Event[], config: Config): Message[] {
  return [...prefix(events, config), { role: 'user', content: material.map(e => record(e, config.ownerName ?? '负责人')).join('\n\n') },
    { role: 'user', content: `现在是${localTime(Date.now())}。\n\n这不是一次对话，不需要回复任何人。\n\n上面是你最近的一段经历，按档案原样列出；如果你以前写下过什么，也在上面。\n\n你可以写下任何想留给以后的自己的东西，也可以什么都不写。写什么、写多少、用什么形式，都由你决定；不需要完整，也不需要准确。\n\n你写下的文字会原样保存。以后对话时，你写下的文字会从最近的一条往前放进你的上下文，总共大约放得下 ${config.writingChars ?? 16000} 字；放不下的旧文字不会消失，仍可以用 check 查到。一次写下的文字过长时，会在长度上限处停止。\n\n你写下的文字不会出现在对话中，但${config.ownerName ?? '负责人'}能够查阅档案。原始记录不会因此改变，以后在对话中需要时，可以用 check 查阅原文。` }];
}

// ISO calendar validation, including local datetimes (Date.parse alone normalizes e.g. February 30).
function dateBound(value: unknown): number {
  if (typeof value !== 'string') throw new Error('invalid date');
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})?)?$/.exec(value);
  if (!match) throw new Error('invalid date');
  const [, y, m, d] = match;
  if (+m < 1 || +m > 12 || +d < 1 || +d > [31, (+y % 4 === 0 && (+y % 100 !== 0 || +y % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][+m - 1]) throw new Error('invalid date');
  const parsed = Date.parse(value.length === 10 ? value + 'T00:00:00' : value);
  if (!Number.isFinite(parsed)) throw new Error('invalid date');
  return parsed;
}
export function check(source: Event[] | (() => Event[]), rawArguments: string, owner: string) {
  let args: unknown;
  try { args = JSON.parse(rawArguments); } catch { args = rawArguments; }
  let params: Record<string, unknown>, from: number, to: number;
  try {
    if (!args || typeof args !== 'object' || Array.isArray(args)) throw new Error();
    params = args as Record<string, unknown>;
    if (Object.keys(params).some(k => !['query', 'from', 'to'].includes(k)) ||
      (params.query !== undefined && typeof params.query !== 'string')) throw new Error();
    from = params.from === undefined ? -Infinity : dateBound(params.from);
    to = params.to === undefined ? Infinity : dateBound(params.to);
    if (from > to) throw new Error();
  } catch {
    return { meta: { arguments: args, invalid: true, result_seqs: [], total: 0 }, content: '查阅参数无效；请使用子串及有效的日期范围。' };
  }
  const events = typeof source === 'function' ? source() : source;
  const matches = events.filter(e => e.branch === 'dev:v2-dev' && e.scene === 'web' &&
    (isDialogue(e) || (e.class === 'inner' && e.kind === 'wrote' && e.content !== '')) &&
    e.t_recorded >= from && e.t_recorded <= to && e.content.includes(params.query as string ?? ''));
  const results: Event[] = []; let chars = 0;
  for (const e of matches.slice().reverse()) {
    if (results.length && (results.length === 40 || chars + e.content.length > 16000)) break;
    results.push(e); chars += e.content.length;
  }
  results.reverse();
  return { meta: { arguments: args, result_seqs: results.map(e => e.seq), total: matches.length },
    content: `共匹配${matches.length}条，返回${results.length}条。\n\n${results.map(e => record(e, owner, true)).join('\n\n')}` };
}
