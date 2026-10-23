export interface ModelConfig {
  baseUrl: string; apiKey: string; model: string;
  idleTimeoutMs?: number; maxDurationMs?: number;
}
export interface Message { role: 'system' | 'user' | 'assistant' | 'tool'; content: string;
  tool_calls?: { id: string; type: 'function'; function: { name: string; arguments: string } }[]; tool_call_id?: string; }
export interface ToolCall { name: string; arguments: string; id?: string; }
export type Usage = Record<string, unknown>;

export class ModelFailure extends Error {
  constructor(readonly httpStatus?: number) { super('Model request failed or timed out.'); }
}
export const silentTool = { type: 'function', function: { name: 'stay_silent',
  parameters: { type: 'object', properties: { reason: { type: 'string' } }, additionalProperties: false } } };
export const checkTool = { type: 'function', function: { name: 'check',
  description: '查阅档案原文：返回本场景中符合条件的原始记录，逐字，带时间和作者，也包括你自己以前写下的文字。查阅会被记录。当你要把过去的事当作事实告诉别人时，先用它核对。',
  parameters: { type: 'object', properties: { query: { type: 'string' }, from: { type: 'string' }, to: { type: 'string' } }, additionalProperties: false } } };
export interface RequestParameters { tools?: (typeof silentTool | typeof checkTool)[]; tool_choice?: 'auto'; max_tokens?: number; }
export interface RequestOptions { parameters?: RequestParameters; mode?: 'dialogue' | 'consolidation'; lastStep?: boolean; maxTokens?: number; finish?: (reason: unknown) => void; }

// Used by assembly and by direct model-client callers (P1–P6 compatibility).
export function requestParameters(options: RequestOptions = {}): RequestParameters {
  return options.mode === 'consolidation' ? { max_tokens: options.maxTokens } : {
    tools: options.lastStep ? [silentTool] : [silentTool, checkTool], tool_choice: 'auto'
  };
}

// Provider bodies and exceptions never cross this boundary: they may echo credentials.
export async function streamModel(config: ModelConfig, messages: Message[],
  delta: (text: string) => void, usage: (value: Usage) => void, options: RequestOptions = {}): Promise<ToolCall[]> {
  const controller = new AbortController();
  let idleTimer: ReturnType<typeof setTimeout>;
  const resetIdle = () => {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => controller.abort(), config.idleTimeoutMs ?? 60_000);
  };
  resetIdle();
  const maxTimer = setTimeout(() => controller.abort(), config.maxDurationMs ?? 600_000);
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  const tools = new Map<number, ToolCall>();
  try {
    const response = await fetch(config.baseUrl.replace(/\/$/, '') + '/chat/completions', {
      method: 'POST', signal: controller.signal,
      headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: config.model, messages, stream: true,
        ...(options.parameters ?? requestParameters(options)),
        stream_options: { include_usage: true }
      })
    });
    resetIdle(); // Response headers are received data; subsequent body reads reset again.
    if (!response.ok) throw new ModelFailure(response.status);
    if (!response.body) throw new ModelFailure();
    reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '', data: string[] = [], completed = false;
    const line = (value: string) => {
      if (value === '') {
        if (!data.length) return;
        const payload = data.join('\n'); data = [];
        if (payload === '[DONE]') { completed = true; return; }
        const parsed = JSON.parse(payload);
        if (parsed.usage !== undefined && parsed.usage !== null) {
          if (typeof parsed.usage !== 'object' || Array.isArray(parsed.usage)) throw new Error('invalid usage');
          usage(parsed.usage);
        }
        if (parsed.error) throw new Error('provider error');
        const choice = parsed.choices?.[0];
        if (choice?.finish_reason !== undefined && choice.finish_reason !== null) options.finish?.(choice.finish_reason);
        const change = choice?.delta;
        const text = change?.content;
        if (text !== undefined && text !== null && typeof text !== 'string') throw new Error('invalid delta');
        if (text) delta(text);
        if (change?.tool_calls !== undefined) {
          if (!Array.isArray(change.tool_calls)) throw new Error('invalid tools');
          for (const part of change.tool_calls) {
            if (!Number.isSafeInteger(part.index) || part.index < 0) throw new Error('invalid tool index');
            const tool: ToolCall = tools.get(part.index) ?? { name: '', arguments: '' };
            if (part.id !== undefined) {
              if (typeof part.id !== 'string') throw new Error('invalid tool identifier');
              tool.id = (tool.id ?? '') + part.id;
            }
            for (const field of ['name', 'arguments'] as const) {
              const fragment = part.function?.[field];
              if (fragment !== undefined) {
                if (typeof fragment !== 'string') throw new Error('invalid tool fragment');
                tool[field] += fragment;
              }
            }
            tools.set(part.index, tool);
          }
        }
      } else if (value.startsWith('data:')) data.push(value.slice(5).replace(/^ /, ''));
    };
    while (!completed) {
      const chunk = await reader.read();
      if (chunk.done) throw new Error('incomplete stream');
      if (chunk.value.length) resetIdle();
      buffer += decoder.decode(chunk.value, { stream: true });
      // SSE accepts CRLF, LF and CR, including separators split across reads.
      let match: RegExpExecArray | null;
      while ((match = /\r\n|\r|\n/.exec(buffer))) {
        if (match[0] === '\r' && match.index === buffer.length - 1) break;
        const value = buffer.slice(0, match.index);
        buffer = buffer.slice(match.index + match[0].length);
        line(value);
        if (completed) break;
      }
    }
    return [...tools.entries()].sort(([a], [b]) => a - b).map(([, tool]) => tool);
  } catch (error) {
    throw error instanceof ModelFailure ? error : new ModelFailure();
  } finally {
    clearTimeout(idleTimer!); clearTimeout(maxTimer);
    controller.abort();
    await reader?.cancel().catch(() => {});
  }
}

// Called only for a text-free, complete stream. Text takes precedence over tools.
export function silenceReason(tools: ToolCall[]): string {
  if (tools.length !== 1 || tools[0].name !== 'stay_silent') throw new Error('Unsupported tool output');
  const args = tools[0].arguments.trim() ? JSON.parse(tools[0].arguments) : {};
  if (!args || typeof args !== 'object' || Array.isArray(args) ||
    Object.keys(args).some(key => key !== 'reason') ||
    (args.reason !== undefined && typeof args.reason !== 'string')) throw new Error('Invalid tool arguments');
  return args.reason ?? '';
}
