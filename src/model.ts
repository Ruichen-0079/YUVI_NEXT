export interface ModelConfig { baseUrl: string; apiKey: string; model: string; }
export interface Message { role: 'system' | 'user' | 'assistant'; content: string; }

// Provider bodies and exceptions never cross this boundary: they may echo credentials.
export async function streamModel(config: ModelConfig, messages: Message[],
  delta: (text: string) => void, timeoutMs = 30_000): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  try {
    const response = await fetch(config.baseUrl.replace(/\/$/, '') + '/chat/completions', {
      method: 'POST', signal: controller.signal,
      headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: config.model, messages, stream: true })
    });
    if (!response.ok || !response.body) throw new Error('provider response');
    reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '', data: string[] = [], completed = false;
    const line = (value: string) => {
      if (value === '') {
        if (!data.length) return;
        const payload = data.join('\n'); data = [];
        if (payload === '[DONE]') { completed = true; return; }
        const parsed = JSON.parse(payload);
        if (parsed.error) throw new Error('provider error');
        const text = parsed.choices?.[0]?.delta?.content;
        if (text !== undefined && text !== null && typeof text !== 'string') throw new Error('invalid delta');
        if (text) delta(text);
      } else if (value.startsWith('data:')) data.push(value.slice(5).replace(/^ /, ''));
    };
    while (!completed) {
      const chunk = await reader.read();
      if (chunk.done) throw new Error('incomplete stream');
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
  } catch {
    throw new Error('Model request failed or timed out.');
  } finally {
    clearTimeout(timer);
    await reader?.cancel().catch(() => {});
    controller.abort();
  }
}
