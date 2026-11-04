import { varied } from '../p8/corpus.mjs';
// Deterministic synthetic P4 archive. No real data or credentials. Never overwrites.
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assembleContext } from '../../dist/context.js';
import { ARCHIVE_SCHEMA } from '../../dist/schema.js';
export function generate(file, { count = 1_000_000, seed = 67, shape = 'typical' } = {}) {
  if (shape === 'varied') return varied(file, {count,seed});
  if (!Number.isSafeInteger(count) || count < 100 || !['typical','empty','presented'].includes(shape)) throw Error('Invalid synthetic archive options');
  if (existsSync(file)) throw Error('Synthetic archive already exists');
  mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(file);
  let random = seed >>> 0, seq = 0, turn = 0, batches = 0, pending = [], failing = false;
  const rand = () => (random = (Math.imul(random, 1664525) + 1013904223) >>> 0);
  const id = n => '00000000-0000-4000-8000-' + n.toString(16).padStart(12, '0');
  const begin = Date.parse('2023-10-21T00:00:00Z'), span = Date.parse('2026-10-21T00:00:00Z') - begin;
  const counts = {}, recent = [], writings = []; let dialogueCount = 0, coveredCount = 0;
  const presented = shape === 'presented', config = { persona: '确定性合成测试人设\n', ownerName: '负责人', writingChars: 16000 };
  const timestamp = n => begin + Math.floor((n - 1) * span / (count - 1));
  const selectedWritings = () => { const selected = [];let chars=0;for(let i=writings.length-1;i>=0;i--){const e=writings[i];if(selected.length&&chars+e.content.length>16000)break;selected.unshift(e);chars+=e.content.length;}return selected; };
  try {
    db.exec('PRAGMA journal_mode=OFF; PRAGMA synchronous=OFF;'); db.exec(ARCHIVE_SCHEMA);
    const insert = db.prepare(`INSERT INTO events (seq,id,branch,class,kind,scene,actor,t_recorded,reply_to,content,model,meta)
      VALUES (?,?,'dev:v2-dev',?,?,'web',?,?,?,?,?,?)`);
    function add(cls, kind, actor, content = '', reply = null, meta = {}) {
      seq++; counts[kind] = (counts[kind] ?? 0) + 1;
      insert.run(seq,id(seq),cls,kind,actor,timestamp(seq),reply,content,actor === 'yuvi' || kind === 'presented' ? 'synthetic' : null,JSON.stringify(meta));
      const event={seq,id:id(seq),class:cls,kind,actor,content,reply_to:reply,meta,t_recorded:timestamp(seq),scene:'web',branch:'dev:v2-dev'};
      if (['heard','said','silent'].includes(kind)) {pending.push(seq);if(presented){dialogueCount++;recent.push(event);if(recent.length>700)recent.shift();}}
      if(presented&&kind==='wrote'&&content)writings.push(event);
      return event;
    }
    const text = (label, common = false) => `${label} 中文经历 ${common ? '散步' : '阅读'} English Ab_%_é 😀 ` +
      ['看雨 reading window。','茶杯与猫 tea and cat。','路上听到轻声 hello。'][rand() % 3].repeat(1 + rand() % 18);
    function present(input, heard=null) {
      const assembled=assembleContext(input,config,timestamp(seq+1),'UTC',Number(process.versions.node.split('.')[0]),'UTC');
      const event=add('control','presented','system','',heard?.id??null,assembled.manifest);return {assembled,event};
    }
    function presentDialogue(heard){
      const desired=Math.max(0,Math.ceil((dialogueCount-200)/200)*200),start=Math.min(desired,coveredCount);
      return present({purpose:'dialogue',selected:{writings:selectedWritings(),window:recent.slice(-(dialogueCount-start))},heard},heard);
    }
    function cover(discard = false) {
      const batch = pending.splice(0, 200); if (!batch.length) return;
      const material = { from_seq: batch[0], through_seq: batch.at(-1) };
      if (discard) add('control','unconsolidated','system','',null,{ material, reason: 'backlog' });
      else {if(presented)present({purpose:'consolidation',selected:{writings:selectedWritings(),material:recent.filter(e=>e.seq>=batch[0]&&e.seq<=batch.at(-1))},maxTokens:4000});
      add('inner','wrote','yuvi',shape === 'empty' ? '' : text('写给以后'),null,
        { material, finish_reason: batches % 9 === 0 ? 'length' : 'stop', usage: { prompt_tokens: 10, completion_tokens: 4 } });}
      if(presented)coveredCount=dialogueCount-pending.length;
      batches++;
    }
    function dialogue(number, compact = 0) {
      const h = add('experience','heard','owner',text('来话' + number, number % 3 === 0));
      const first=presented?presentDialogue(h):null;
      if (number % 13 === 0 || compact === 5) {const checked=add('act','checked','yuvi','',h.id,
        { arguments: { query: 'absent-synthetic' }, result_seqs: [], total: 0, usage: { prompt_tokens: 2 } });
        if(presented)present({previous:first.assembled,previousId:first.event.id,text:'',calls:[{id:'synthetic-call',name:'check',arguments:'{\"query\":\"absent-synthetic\"}'}],results:[{reference:{checked:checked.id},content:'共匹配0条，返回0条。\n\n'}]},h);
      }
      if (compact === 3 || (!compact && number % 11 === 0)) add('act','silent','yuvi',number % 2 ? '' : '稍后再说',h.id,{ usage: { completion_tokens: 1 } });
      else if (!compact && number % 17 === 0) {
        const outcome = ['not_sent','partial','unknown'][Math.floor(number / 17) % 3];
        const attempt = outcome === 'not_sent' ? null : add('act','reply_attempt','yuvi','',h.id);
        add('control','error','system',outcome === 'partial' ? '部分 raw' : '',h.id,
          { reason: outcome === 'unknown' ? 'interrupted' : 'model_failure', outcome, ...(outcome === 'unknown' ? {} : { request_chars: 0 }), ...(attempt ? { attempt: attempt.id } : {}) });
      } else {
        const a = add('act','reply_attempt','yuvi','',h.id);
        add('act','said','yuvi',text('回应' + number, number % 3 === 0),h.id,{ attempt: a.id, usage: { prompt_tokens: 8, completion_tokens: 3 } });
      }
    }
    db.exec('BEGIN');
    while (seq < count - (presented ? 100 : 20)) {
      dialogue(++turn);
      if (turn === 1) add('control','restored','system','',null,{ through_seq: seq, through_id: id(seq), snapshot_sha256: '0'.repeat(64) });
      if (batches % 7 === 6) failing = true;
      if (failing && pending.length > 400) { cover(true); failing = false; }
      if (!failing) while (pending.length >= 200) cover();
    }
    while (pending.length) cover();
    // Tail macros of 3, 4 or 5 events close every heard and cover all materials,
    // permitting exactly the requested event count without padding fake outcomes.
    while (seq < count) {
      const remaining = count - seq;
      const size = presented ? (remaining % 5 === 0 ? 5 : 6) : remaining <= 5 ? remaining : 3;
      if (size < 3) throw Error('Synthetic tail invariant');
      // Compact tails must not add a periodic checked event of their own.
      let number = ++turn; if (number % 13 === 0) number = ++turn;
      dialogue(number, presented ? (size === 5 ? 3 : 4) : size); cover();
    }
    db.exec('COMMIT; PRAGMA journal_mode=DELETE;');
    return { count: seq, seed, shape, counts, dialogue_events: (counts.heard ?? 0) + (counts.said ?? 0) + (counts.silent ?? 0) };
  } finally { db.close(); }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [file, count, shape, seed] = process.argv.slice(2);
  console.log(JSON.stringify(generate(file, { count: Number(count ?? 1_000_000), shape: shape ?? 'typical', seed: Number(seed ?? 67) })));
}
