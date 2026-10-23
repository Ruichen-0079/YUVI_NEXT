import type { Archive, Event } from './archive.js';
import type { Config } from './config.js';
import { requestParameters, type Message, type ToolCall, type RequestParameters } from './model.js';
import { createHash } from 'node:crypto';

export type PresentationConfig = Pick<Config, 'persona' | 'ownerName' | 'writingChars'>;
export const sha256 = (value: string) => createHash('sha256').update(value, 'utf8').digest('hex');

export function state(archive: Archive, n: number) {
  const progress = archive.progress();
  const desiredStart = Math.max(0, Math.ceil((progress.dialogueCount - n) / n) * n);
  return { ...progress, rawStart: Math.min(desiredStart, progress.coveredCount),
    pressure: desiredStart > progress.coveredCount };
}
export function validTimeZone(value: unknown): value is string {
  if (typeof value !== 'string' || !value) return false;
  try { new Intl.DateTimeFormat('en', { timeZone: value }).format(0); return true; }
  catch { return false; }
}
export function recordedTimeZone(): string | null {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!validTimeZone(zone)) return null;
    const now = Date.now(), year = new Date(now).getFullYear();
    // POSIX GMT signs can be inverted by Intl resolution. Check native Date
    // presentation, including both seasons, before recording a replay zone.
    return [now, Date.UTC(year, 0, 1), Date.UTC(year, 6, 1)]
      .every(t => localTime(t) === localTime(t, zone)) ? zone : null;
  }
  catch { return null; }
}
const clocks = new Map<string, Intl.DateTimeFormat>();
export function localTime(ms: number, timeZone?: string): string {
  const d = new Date(ms), pad = (n: number) => String(n).padStart(2, '0');
  let year = d.getFullYear(), month = d.getMonth() + 1, day = d.getDate(), hour = d.getHours(), minute = d.getMinutes(), second = d.getSeconds();
  let offset = -d.getTimezoneOffset();
  if (timeZone !== undefined) {
    let clock = clocks.get(timeZone);
    if (!clock) {
      clock = new Intl.DateTimeFormat('en-GB', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }); clocks.set(timeZone, clock);
    }
    const parts = Object.fromEntries(clock.formatToParts(d).map(p => [p.type, p.value]));
    year = +parts.year; month = +parts.month; day = +parts.day; hour = +parts.hour; minute = +parts.minute; second = +parts.second;
    offset = Math.trunc((Date.UTC(year, month - 1, day, hour, minute, second) - Math.floor(ms / 1000) * 1000) / 60000);
  }
  return `${year}-${pad(month)}-${pad(day)} ${pad(hour)}:${pad(minute)}:${pad(second)}（UTC${offset < 0 ? '-' : '+'}${pad(Math.floor(Math.abs(offset) / 60))}:${pad(Math.abs(offset) % 60)}）`;
}
export function record(e: Event, owner: string, includeReason = false, timeZone?: string): string {
  const time = localTime(e.t_recorded, timeZone);
  if (e.kind === 'heard') return `${time} ${owner}说：\n${e.content}`;
  if (e.kind === 'said') return `${time} 你说：\n${e.content}`;
  if (e.kind === 'silent') return `${time} 你没有回复。${includeReason && e.content ? '\n当时给出的理由：\n' + e.content : ''}`;
  return `${time} 你写下的文字${e.meta.finish_reason === 'length' ? '（因长度上限停止）' : ''}：\n${e.content}`;
}
export function writings(archive: Archive, budget: number): Event[] {
  return archive.writings(budget);
}
export function renderPrefix(selected: Event[], config: Pick<Config, 'persona' | 'ownerName'>, timeZone?: string): Message[] {
  return [{ role: 'system', content: config.persona },
    ...selected.map(e => ({ role: 'user' as const, content: record(e, config.ownerName ?? '负责人', false, timeZone) }))];
}
export function renderDialogue(selected: { writings: Event[]; window: Event[] }, heard: Event, config: PresentationConfig, now: number, timeZone?: string): Message[] {
  return [...renderPrefix(selected.writings, config, timeZone), ...selected.window.map(e => ({
    role: e.kind === 'said' ? 'assistant' as const : 'user' as const,
    content: e.kind === 'said' ? e.content : record(e, config.ownerName ?? '负责人', false, timeZone)
  })), { role: 'user', content: `现在是${localTime(now, timeZone)}。当前回应的是${config.ownerName ?? '负责人'}在${localTime(heard.t_recorded, timeZone)}说的这一句：\n${heard.content}` }];
}
export function renderConsolidation(selected: { writings: Event[]; material: Event[] }, config: PresentationConfig, now: number, timeZone?: string): Message[] {
  return [...renderPrefix(selected.writings, config, timeZone), { role: 'user', content: selected.material.map(e => record(e, config.ownerName ?? '负责人', false, timeZone)).join('\n\n') },
    { role: 'user', content: `现在是${localTime(now, timeZone)}。\n\n这不是一次对话，不需要回复任何人。\n\n上面是你最近的一段经历，按档案原样列出；如果你以前写下过什么，也在上面。\n\n你可以写下任何想留给以后的自己的东西，也可以什么都不写。写什么、写多少、用什么形式，都由你决定；不需要完整，也不需要准确。\n\n你写下的文字会原样保存。以后对话时，你写下的文字会从最近的一条往前放进你的上下文，总共大约放得下 ${config.writingChars ?? 16000} 字；放不下的旧文字不会消失，仍可以用 check 查到。一次写下的文字过长时，会在长度上限处停止。\n\n你写下的文字不会出现在对话中，但${config.ownerName ?? '负责人'}能够查阅档案。原始记录不会因此改变，以后在对话中需要时，可以用 check 查阅原文。` }];
}

// Selection reads only the bounded parts already defined by P6.
export function selectDialogue(archive: Archive, config: Config) {
  return { writings: writings(archive, config.writingChars ?? 16000),
    window: archive.dialogue(state(archive, config.contextEvents).rawStart) };
}
export function selectConsolidation(archive: Archive, material: Event[], config: Config) {
  return { writings: writings(archive, config.writingChars ?? 16000), material };
}
export function prefix(archive: Archive, config: Config): Message[] {
  return renderPrefix(writings(archive, config.writingChars ?? 16000), config);
}
export function dialogueMessages(archive: Archive, heard: Event, config: Config): Message[] {
  return renderDialogue(selectDialogue(archive, config), heard, config, Date.now());
}
export function consolidationMessages(archive: Archive, material: Event[], config: Config): Message[] {
  return renderConsolidation(selectConsolidation(archive, material, config), config, Date.now());
}

export interface Section {
  name: 'persona' | 'writings' | 'window' | 'material' | 'instruction' | 'step';
  messages: number; chars: number;
  first_seq?: number; last_seq?: number; count?: number; heard?: string;
  index?: number; assistant_text?: string; tool_calls?: { id: string; name: string; arguments: string }[];
  results?: ({ checked: string } | { ignored: string })[];
}
export interface PresentationManifest extends Record<string, unknown> {
  format: number; rules: string; purpose: 'dialogue' | 'consolidation'; step?: number; previous?: string;
  now: number; time_zone: string | null; owner_name: string; writing_chars: number; node_major: number;
  request: { tools: string[]; max_tokens?: number }; persona: { sha256: string; chars: number };
  sections: Section[]; total: { messages: number; chars: number }; messages_sha256: string;
}
export interface Assembly { messages: Message[]; parameters: RequestParameters; manifest: PresentationManifest; }
export function messageSize(messages: Message[]) {
  return { messages: messages.length, chars: messages.reduce((sum, m) => sum + m.content.length, 0) };
}
// Runtime uses P6 native Date formatting; replay explicitly supplies the recorded zone.
// Source events and the clock value are explicit in both paths.
// The same messages drive the section counts, request parameters and digest.
export function assembleBase(input: {
  purpose: 'dialogue'; selected: { writings: Event[]; window: Event[] }; heard: Event;
} | {
  purpose: 'consolidation'; selected: { writings: Event[]; material: Event[] }; maxTokens: number;
}, config: PresentationConfig, now: number, timeZone: string | null, nodeMajor: number, renderTimeZone?: string): Assembly {
  const messages = input.purpose === 'dialogue' ? renderDialogue(input.selected, input.heard, config, now, renderTimeZone) :
    renderConsolidation(input.selected, config, now, renderTimeZone);
  const sections: Section[] = [];
  let offset = 0;
  const part = (name: Section['name'], count: number, references: Partial<Section> = {}) => {
    if (!count) return;
    sections.push({ name, ...messageSize(messages.slice(offset, offset + count)), ...references }); offset += count;
  };
  const range = (events: Event[]) => ({ first_seq: events[0].seq, last_seq: events.at(-1)!.seq, count: events.length });
  part('persona', 1);
  const writings = input.selected.writings;
  if (writings.length) part('writings', writings.length, range(writings));
  if (input.purpose === 'dialogue') {
    if (input.selected.window.length) part('window', input.selected.window.length, range(input.selected.window));
    part('instruction', 1, { heard: input.heard.id });
  } else {
    part('material', 1, range(input.selected.material)); part('instruction', 1);
  }
  const parameters = requestParameters(input.purpose === 'dialogue' ? {} : { mode: 'consolidation', maxTokens: input.maxTokens });
  return { messages, parameters, manifest: {
    format: 1 as const, rules: 'p7', purpose: input.purpose, ...(input.purpose === 'dialogue' ? { step: 0 } : {}),
    now, time_zone: timeZone, node_major: nodeMajor, writing_chars: config.writingChars ?? 16000, owner_name: config.ownerName ?? '负责人',
    request: { tools: parameters.tools?.map(tool => tool.function.name) ?? [],
      ...(parameters.max_tokens === undefined ? {} : { max_tokens: parameters.max_tokens }) },
    persona: { sha256: sha256(config.persona), chars: config.persona.length }, sections,
    total: messageSize(messages), messages_sha256: sha256(JSON.stringify(messages))
  } };
}

export type StepResult = { reference: { checked: string } | { ignored: string }; content: string };
export function renderStep(text: string, calls: NonNullable<Section['tool_calls']>, replies: string[]): Message[] {
  return [{ role: 'assistant', content: text, tool_calls: calls.map(call => ({
    id: call.id, type: 'function', function: { name: call.name, arguments: call.arguments }
  })) }, ...calls.map((call, index) => ({ role: 'tool' as const, tool_call_id: call.id, content: replies[index] }))];
}
// Single entry for the three request paths. Continuations inherit the exact
// previous messages; neither archive selection nor base rendering is repeated.
export function assembleContext(input: Parameters<typeof assembleBase>[0] | {
  previous: Assembly; previousId: string; text: string; calls: ToolCall[]; results: StepResult[];
}, config: PresentationConfig, now: number, timeZone: string | null, nodeMajor: number, renderTimeZone?: string): Assembly {
  if (!('previous' in input)) return assembleBase(input, config, now, timeZone, nodeMajor, renderTimeZone);
  const prior = input.previous, index = prior.manifest.step!;
  const calls = input.calls.map((call, i) => ({ id: call.id || `call_${index}_${i}`, name: call.name, arguments: call.arguments }));
  const appended = renderStep(input.text, calls, input.results.map(result => result.content));
  const messages = [...prior.messages, ...appended], parameters = requestParameters({ lastStep: index + 1 === 3 });
  const section: Section = { name: 'step', ...messageSize(appended), index, assistant_text: input.text,
    tool_calls: calls, results: input.results.map(result => result.reference) };
  return { messages, parameters, manifest: { ...prior.manifest, step: index + 1, previous: input.previousId,
    now, request: { tools: parameters.tools!.map(tool => tool.function.name) },
    sections: [...prior.manifest.sections, section], total: messageSize(messages), messages_sha256: sha256(JSON.stringify(messages)) } };
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
export function check(archive: Archive, rawArguments: string, owner: string) {
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
  const { results, total } = archive.search(params.query as string ?? '', from, to);
  return { meta: { arguments: args, result_seqs: results.map(e => e.seq), total },
    content: `共匹配${total}条，返回${results.length}条。\n\n${results.map(e => record(e, owner, true)).join('\n\n')}` };
}
