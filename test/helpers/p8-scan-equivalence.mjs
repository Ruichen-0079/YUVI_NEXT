import assert from 'node:assert/strict';
// P8 deliberately changes only the tool-result explanation on forced scan.
// Validate that exact addition before comparing the remaining P6 request bytes.
export const scanExplanation='逐字查找、按时间排列。已退回逐字查找：检索目录暂不可用。';
export function legacyP8Requests(requests){return requests.map(body=>({...body,messages:body.messages.map(m=>{
 if(m.role!=='tool'||!m.content.startsWith('共匹配'))return {...m};
 const match=/^(共匹配\d+条，返回\d+条。)([^\n]*)(\n\n[\s\S]*)$/.exec(m.content);
 assert.ok(match,'Unrecognized tool-result format');assert.equal(match[2],scanExplanation,'Only the specified scan explanation may differ');
 return {...m,content:match[1]+match[3]};
})}));}
export function legacyP8Events(events){
 return events.map(event=>{
  const e=structuredClone(event);
  if(e.class==='act'&&e.kind==='checked'&&e.meta.rules==='p8'){
   assert.equal(e.meta.engine,'scan');assert.equal(e.meta.mode,'substring');assert.equal(e.meta.fallback,'index_unavailable');
   assert.deepEqual(e.meta.terms,[]);assert.deepEqual(e.meta.dropped,[]);assert.ok(Array.isArray(e.meta.rank_seqs)&&e.meta.rank_seqs.length<=100);
   for(const field of ['rules','engine','mode','fallback','terms','dropped','rank_seqs'])delete e.meta[field];
  }
  if(e.class==='control'&&e.kind==='error'&&Object.hasOwn(e.meta,'request_chars')){
   const checks=events.filter(c=>c.seq<e.seq&&c.reply_to===e.reply_to&&c.kind==='checked'&&c.meta.rules==='p8'&&!c.meta.invalid);
   e.meta.request_chars-=checks.length*scanExplanation.length;
  }
  return e;
 });
}
