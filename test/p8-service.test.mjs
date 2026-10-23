import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync,rmSync,chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { Archive } from '../dist/archive.js';
import { listen,startService,text,tool,done } from './helpers/p6-process.mjs';
import { readEvents,capturePresentation,assertPresentations } from './helpers/p7-records.mjs';

test('P8 C3/C4/C8/C10: actual service check fields, current heard, indexed/emoji fallback and exact historical replay',async t=>{
 const root=mkdtempSync(join(tmpdir(),'yuvi-p8-service-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
 const data=join(root,'data'),seed=new Archive(data);
 const first=seed.append({class:'experience',kind:'heard',actor:'owner',content:'我的猫叫年糕。'});seed.append({class:'act',kind:'silent',actor:'yuvi',reply_to:first.id});
 const second=seed.append({class:'experience',kind:'heard',actor:'owner',content:'更正：猫叫豆包。🎉'});seed.append({class:'act',kind:'silent',actor:'yuvi',reply_to:second.id});seed.close();
 let query='猫叫什么来着',captured=[];
 const fake=createServer(async(req,res)=>{const chunks=[];for await(const c of req)chunks.push(c);const body=JSON.parse(Buffer.concat(chunks).toString('utf8'));captured.push(capturePresentation(data,body));
  res.end(!body.tools?text('保留原文')+done():body.messages.some(m=>m.role==='tool')?text('核对完成。')+done({prompt_tokens:4}):tool('check',{query})+done({prompt_tokens:3}));
 });const base=await listen(fake);t.after(()=>new Promise(r=>fake.close(r)));
 const s=await startService(root,{data,baseUrl:base});t.after(()=>s.stop());
 await s.post('先核对之前的事情');let checked=readEvents(data).findLast(e=>e.kind==='checked');
 assert.equal(checked.meta.rules,'p8');assert.equal(checked.meta.engine,'index');assert.equal(checked.meta.mode,'relevance');assert.deepEqual(checked.meta.result_seqs,[first.seq,second.seq]);
 query='当前这句独有';await s.post('当前这句独有');checked=readEvents(data).findLast(e=>e.kind==='checked');const heard=readEvents(data).findLast(e=>e.kind==='heard');assert.ok(checked.meta.result_seqs.includes(heard.seq));
 query='🎉';await s.post('再查符号');checked=readEvents(data).findLast(e=>e.kind==='checked');assert.equal(checked.meta.engine,'scan');assert.equal(checked.meta.fallback,'no_terms');assert.deepEqual(checked.meta.result_seqs,[second.seq]);
 chmodSync(join(data,'index.sqlite'),0o400);query='年糕';await s.post('目录故障后继续');checked=readEvents(data).findLast(e=>e.kind==='checked');assert.equal(checked.meta.engine,'scan');assert.equal(checked.meta.fallback,'index_unavailable');assert.ok(checked.meta.result_seqs.includes(first.seq));
 const events=assertPresentations(data,captured,'测试人设原文\n',{cliFile:join(root,'persona.txt')});assert.equal(events.filter(e=>e.kind==='said').length,4);assert.match(s.output,/Archive index unavailable; using literal archive search\./);
 const db=new DatabaseSync(join(data,'archive.sqlite'),{readOnly:true});try{assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');}finally{db.close();}
});
