export const page = `<!doctype html>
<html lang="zh-CN"><meta charset="utf-8"><title>YUVI</title>
<body><h1>YUVI</h1><div id="conversation" aria-live="polite"></div>
<form id="form"><label>消息 <input id="text" autocomplete="off" required></label><button>发送</button></form>
<p id="status" role="status"></p>
<script>
const list = document.querySelector('#conversation'), status = document.querySelector('#status');
const input = document.querySelector('#text'), form = document.querySelector('#form');
function add(author, text) {
  const row = document.createElement('p');
  const label = document.createElement('strong'); label.textContent = author + ': ';
  const body = document.createElement('span'); body.textContent = text;
  row.append(label, body); list.append(row); return body;
}
async function history() {
  const response = await fetch('/api/events');
  if (!response.ok) throw Error('无法读取历史');
  list.replaceChildren();
  for (const event of await response.json()) {
    if (event.kind === 'heard' || event.kind === 'said') add(event.actor, event.content);
    else if (event.kind === 'error') {
      if (event.content) add('yuvi（未完成）', event.content);
      add('system', '回复失败或中断（' + event.meta.outcome + '）');
    }
  }
}
const ready = history().catch(() => { status.textContent = '读取历史失败，请刷新重试。'; });
form.addEventListener('submit', async event => {
  event.preventDefault(); await ready;
  const text = input.value; if (!text.trim()) return;
  input.value = ''; add('owner', text);
  const reply = add('yuvi', '');
  status.textContent = '等待回复…';
  let terminal = false;
  try {
    const response = await fetch('/api/messages', { method: 'POST',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
    if (!response.ok || !response.body) throw Error();
    const reader = response.body.getReader(), decoder = new TextDecoder(); let buffer = '';
    while (true) {
      const chunk = await reader.read(); if (chunk.done) break;
      buffer += decoder.decode(chunk.value, { stream: true });
      let boundary;
      while ((boundary = buffer.indexOf('\\n\\n')) >= 0) {
        const frame = buffer.slice(0, boundary); buffer = buffer.slice(boundary + 2);
        const lines = frame.split('\\n');
        const kind = lines.find(line => line.startsWith('event: '))?.slice(7);
        const data = lines.find(line => line.startsWith('data: '))?.slice(6);
        if (kind === 'delta') reply.textContent += JSON.parse(data).text;
        if (kind === 'done') { terminal = true; status.textContent = ''; }
        if (kind === 'error') { terminal = true; status.textContent = JSON.parse(data).message; }
      }
    }
    if (!terminal) throw Error();
  } catch { status.textContent = '连接中断或请求失败，请刷新查看记录。'; }
});
</script></body></html>`;
