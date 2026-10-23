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

test('P8 K7: replacing the stopped archive preserves the replacement exactly and rebuilds stale derived identity',async t=>{
 const root=mkdtempSync(join(tmpdir(),'yuvi-p8-swap-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
 const data=join(root,'data'),firstArchive=new Archive(data);
 const old=firstArchive.append({class:'experience',kind:'heard',actor:'owner',content:'被换出的独有雪豹'});firstArchive.append({class:'act',kind:'silent',actor:'yuvi',reply_to:old.id});firstArchive.close();
 let query='雪豹';const fake=createServer(async(req,res)=>{const chunks=[];for await(const c of req)chunks.push(c);const body=JSON.parse(Buffer.concat(chunks).toString('utf8'));
  res.end(!body.tools?text('')+done():body.messages.some(m=>m.role==='tool')?text('看过了。')+done():tool('check',{query})+done());
 });const base=await listen(fake);t.after(()=>new Promise(r=>fake.close(r)));
 const s=await startService(root,{data,baseUrl:base});await s.post('先查询');await s.stop();
 const replacement=join(root,'replacement'),a=new Archive(replacement),h=a.append({class:'experience',kind:'heard',actor:'owner',content:'新档案独有海豚'});a.append({class:'act',kind:'silent',actor:'yuvi',reply_to:h.id});
 a.append({class:'inner',kind:'wrote',actor:'yuvi',content:'',meta:{material:{from_seq:1,through_seq:2},finish_reason:'stop'}});
 const read=db=>db.prepare('SELECT *,hex(CAST(content AS BLOB)) original_bytes FROM events ORDER BY seq').all();
 const prefix=read(a.db),schema=a.db.prepare('SELECT * FROM sqlite_master ORDER BY name').all();a.close();
 const {copyFileSync,existsSync}=await import('node:fs');
 for(const suffix of ['-wal','-shm'])rmSync(join(data,'archive.sqlite')+suffix,{force:true});copyFileSync(join(replacement,'archive.sqlite'),join(data,'archive.sqlite'));
 const {spawnSync}=await import('node:child_process');const verify=()=>spawnSync(process.execPath,['dist/maintenance.js','index','verify','--full'],{env:{...process.env,YUVI_DATA_DIR:data},encoding:'utf8'});
 assert.equal(JSON.parse(verify().stdout).status,'mismatch');
 const restarted=await startService(root,{data,baseUrl:base});t.after(()=>restarted.stop());
 let db=new DatabaseSync(join(data,'archive.sqlite'),{readOnly:true});try{assert.deepEqual(read(db),prefix);assert.deepEqual(db.prepare('SELECT * FROM sqlite_master ORDER BY name').all(),schema);}finally{db.close();}
 assert.equal(JSON.parse(verify().stdout).status,'ok');query='海豚';await restarted.post('现在查询新档案');let events=readEvents(data),checked=events.findLast(e=>e.kind==='checked');assert.deepEqual(checked.meta.result_seqs,[h.seq]);
 query='雪豹';await restarted.post('确认没有旧档案');checked=readEvents(data).findLast(e=>e.kind==='checked');assert.equal(checked.meta.total,0);
 db=new DatabaseSync(join(data,'archive.sqlite'),{readOnly:true});try{assert.deepEqual(read(db).slice(0,prefix.length),prefix);assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');}finally{db.close();}
 assert.ok(existsSync(join(data,'index.sqlite')));
});

test('P8 K1-K6: real service repairs each stopped-index fault without changing the archive prefix or business event sequence',async t=>{
 const root=mkdtempSync(join(tmpdir(),'yuvi-p8-fault-process-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
 const {buildIndex}=await import('../dist/archive-index.js');
 const {readFileSync,writeFileSync,truncateSync,statSync}=await import('node:fs');
 const {spawnSync}=await import('node:child_process');
 const fake=createServer(async(req,res)=>{const chunks=[];for await(const c of req)chunks.push(c);const body=JSON.parse(Buffer.concat(chunks).toString('utf8'));
  res.end(!body.tools?text('')+done():body.messages.some(m=>m.role==='tool')?text('相同结局')+done({prompt_tokens:5}):tool('check',{query:'小院'})+done({prompt_tokens:4}));
 });const base=await listen(fake);t.after(()=>new Promise(r=>fake.close(r)));
 let normalKinds;
 for(const fault of ['healthy','missing','truncate','page','version','through','count'])await t.test(fault,async()=>{
  const data=join(root,fault),a=new Archive(data);
  for(let i=0;i<15;i++){const h=a.append({class:'experience',kind:'heard',actor:'owner',content:'小院经历'+i});a.append({class:'act',kind:'silent',actor:'yuvi',reply_to:h.id});}
  a.append({class:'inner',kind:'wrote',actor:'yuvi',content:'',meta:{material:{from_seq:1,through_seq:30},finish_reason:'stop'}});buildIndex(data);
  const prefix=a.db.prepare('SELECT *,hex(CAST(content AS BLOB)) original_bytes FROM events ORDER BY seq').all(),schema=a.db.prepare('SELECT * FROM sqlite_master ORDER BY name').all();a.close();
  const file=join(data,'index.sqlite');
  if(fault==='missing')rmSync(file);
  if(fault==='truncate')truncateSync(file,Math.floor(statSync(file).size/2));
  if(fault==='page'){const bytes=readFileSync(file);bytes.fill(0xff,4096,8192);writeFileSync(file,bytes);}
  if(['version','through','count'].includes(fault)){const db=new DatabaseSync(file);try{
   if(fault==='version')db.prepare('UPDATE metadata SET value=? WHERE key=?').run('"obsolete"','tokenizer');
   if(fault==='through')db.prepare('UPDATE metadata SET value=? WHERE key=?').run('"wrong"','through_id');
   if(fault==='count')db.exec('DELETE FROM docs WHERE seq<=10;DELETE FROM terms WHERE rowid<=10');
  }finally{db.close();}}
  const verify=()=>spawnSync(process.execPath,['dist/maintenance.js','index','verify','--full'],{env:{...process.env,YUVI_DATA_DIR:data},encoding:'utf8'});
  const expected={healthy:'ok',missing:'missing',truncate:'corrupt',page:'corrupt',version:'version',through:'mismatch',count:'mismatch'};
  assert.equal(JSON.parse(verify().stdout).status,expected[fault]);
  const s=await startService(root,{data,baseUrl:base});try{
   let db=new DatabaseSync(join(data,'archive.sqlite'),{readOnly:true});try{assert.deepEqual(db.prepare('SELECT *,hex(CAST(content AS BLOB)) original_bytes FROM events ORDER BY seq').all(),prefix);}finally{db.close();}
   assert.equal(JSON.parse(verify().stdout).status,'ok');const frames=await s.post('请查小院');assert.equal(frames.at(-1).event,'done');
   const all=readEvents(data),checked=all.findLast(e=>e.kind==='checked');assert.deepEqual(checked.meta.result_seqs,[...Array.from({length:15},(_,i)=>1+i*2),32]);
   const kinds=all.slice(prefix.length).map(e=>[e.class,e.kind]);if(normalKinds)assert.deepEqual(kinds,normalKinds);else normalKinds=kinds;
   db=new DatabaseSync(join(data,'archive.sqlite'),{readOnly:true});try{
    assert.deepEqual(db.prepare('SELECT *,hex(CAST(content AS BLOB)) original_bytes FROM events WHERE seq<=? ORDER BY seq').all(prefix.length),prefix);
    assert.deepEqual(db.prepare('SELECT * FROM sqlite_master ORDER BY name').all(),schema);assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
   }finally{db.close();}
   for(const token of ['小院','obsolete','经历'])assert.equal(s.output.includes(token),false,'No source or index tokens in logs');
  }finally{await s.stop();}
 });
});
