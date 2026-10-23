import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { Archive } from '../dist/archive.js';
import { terms, buildIndex, verifyIndex, ArchiveIndex } from '../dist/archive-index.js';

test('P8 segmentation keeps CJK unigrams/bigrams, word marks and NFKC; query order is stable',()=>{
 assert.deepEqual(terms('猫叫什么来着',true),['猫叫','叫什','什么','么来','来着']);
 assert.deepEqual(terms('露川-4A87',true),['露川','4a87']);
 assert.deepEqual(terms('ＡＢＣ１２３ café カナ 한글'),['abc123','café','カ','ナ','カナ','한','글','한글']);
 assert.deepEqual(terms('🎉\ud800 % * : " OR -x'),['or','x']);
 assert.deepEqual(terms('年糕 年糕',true),['年糕']);
});

test('P8 contentless index: exact vocab, bounded rank/recency selection, incremental watermarks, validation',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'yuvi-p8-index-')),a=new Archive(dir);let index;
 try{
  const add=(content,kind='heard')=>a.append({class:kind==='wrote'?'inner':kind==='heard'?'experience':'act',kind,actor:'owner',content});
  const one=add('我的猫叫年糕，三岁了'),two=add('更正：其实猫叫豆包');
  add('café カナ 한글 ＡＢＣ１２３ ΟΣ İSTANBUL');add(''),add('理由','silent');
  add('截断\0不应索引尾部');add('写下灯塔','wrote');
  for(let i=0;i<60;i++)add('糖葫芦'+String(i));
  buildIndex(dir);assert.equal(verifyIndex(a.db,join(dir,'index.sqlite'),true).status,'ok');
  const db=new DatabaseSync(join(dir,'index.sqlite'),{readOnly:true});
  try{
   for(const term of ['café','カナ','한글','abc123','ος','i̇stanbul'])assert.ok(db.prepare('SELECT * FROM vocab WHERE term=?').get(term),term);
   assert.equal(db.prepare('SELECT words FROM terms LIMIT 1').get().words,null);
   assert.equal(db.prepare('SELECT * FROM vocab WHERE term=?').get('尾部'),undefined);
  }finally{db.close();}
  index=new ArchiveIndex(a.db,dir);
  const r=index.search('猫叫什么来着',-Infinity,Infinity);
  assert.ok(!('fallback'in r));assert.equal(r.total,2);assert.deepEqual(r.results.map(e=>e.seq),[one.seq,two.seq]);const ranked=new DatabaseSync(join(dir,'index.sqlite'),{readOnly:true});try{assert.deepEqual(r.meta.rank_seqs,ranked.prepare('SELECT rowid FROM terms WHERE terms MATCH ? ORDER BY rank,rowid DESC').all('\"猫叫\"').map(r=>Number(r.rowid)));}finally{ranked.close();}
  const many=index.search('糖葫芦',-Infinity,Infinity);assert.equal(many.total,60);assert.equal(many.results.length,40);assert.equal(many.meta.rank_seqs.length,60);
  const fresh=add('新增喀纳斯');assert.equal(index.search('喀纳斯',-Infinity,Infinity).results[0].seq,fresh.seq);
  assert.equal(verifyIndex(a.db,index.file,true).status,'ok');
  assert.equal(index.search('灯塔',-Infinity,Infinity,['wrote']).total,1);assert.equal(index.search('年糕',-Infinity,Infinity,['wrote']).total,0);
  index.close();index=undefined;
  const mutate=new DatabaseSync(join(dir,'index.sqlite'));mutate.exec('DELETE FROM docs WHERE seq=1');mutate.close();
  assert.equal(verifyIndex(a.db,join(dir,'index.sqlite')).status,'mismatch');
  index=new ArchiveIndex(a.db,dir);await index.ready();assert.equal(verifyIndex(a.db,index.file,true).status,'ok');
 }finally{index?.close();a.close();rmSync(dir,{recursive:true,force:true});}
});

test('P8 asynchronous scan freezes its archive prefix before a queued receipt is appended',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'yuvi-p8-scan-cut-')),a=new Archive(dir);let index;
 try{
  const old=a.append({class:'experience',kind:'heard',actor:'owner',content:'相同查阅词'});index=new ArchiveIndex(a.db,dir);
  const pending=index.scan(JSON.stringify({query:'查阅词'}),'负责人','index_building');
  const queued=a.append({class:'experience',kind:'heard',actor:'owner',content:'另一句也有查阅词'});
  const result=await pending;assert.equal(result.meta.total,1);assert.deepEqual(result.meta.result_seqs,[old.seq]);assert.ok(!result.meta.rank_seqs.includes(queued.seq));
  const next=await index.scan(JSON.stringify({query:'查阅词'}),'负责人','index_unavailable');assert.equal(next.meta.total,2);assert.deepEqual(next.meta.result_seqs,[old.seq,queued.seq]);
 }finally{await index?.close();a.close();rmSync(dir,{recursive:true,force:true});}
});

test('P8 forced newest result remains truthful when its relevance rank is beyond the recorded top100',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'yuvi-p8-ranked-newest-')),a=new Archive(dir);let index;
 try{
  const first=a.append({class:'experience',kind:'heard',actor:'owner',content:'橙色信封'});
  for(let i=0;i<105;i++)a.append({class:'experience',kind:'heard',actor:'owner',content:'橙色信封'+'日常'.repeat(30+i)});
  const newest=a.append({class:'experience',kind:'heard',actor:'owner',content:'橙色信封'+'日常'.repeat(10000)});
  index=new ArchiveIndex(a.db,dir);const r=index.search('橙色信封',-Infinity,Infinity);
  assert.deepEqual(r.results.map(e=>e.seq),[first.seq,newest.seq]);assert.equal(r.meta.rank_seqs.length,100);assert.equal(r.meta.rank_seqs.includes(newest.seq),false);
  assert.ok(r.results.reduce((n,e)=>n+e.content.length,0)>16000,'The two mandatory records are never truncated');
 }finally{await index?.close();a.close();rmSync(dir,{recursive:true,force:true});}
});

test('P8 derived-row corruption cannot expose control events and causes a rebuild',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'yuvi-p8-index-source-')),a=new Archive(dir);let index;
 try{
  a.append({class:'experience',kind:'heard',actor:'owner',content:'正常来源'});index=new ArchiveIndex(a.db,dir);
  const control=a.append({class:'control',kind:'presented',actor:'system',content:'隐藏事件原文'});
  const db=new DatabaseSync(index.file);try{
   db.prepare('INSERT INTO docs VALUES(?,?,?,?,?)').run(control.seq,control.kind,control.t_recorded,control.content.length,'not-a-source-hash');
   db.prepare('INSERT INTO terms(rowid,words) VALUES(?,?)').run(control.seq,terms(control.content).join(' '));
  }finally{db.close();}
  const failed=index.search('隐藏事件',-Infinity,Infinity);assert.equal(failed.fallback,'index_building');
  assert.equal(index.search('隐藏事件',-Infinity,Infinity).total,0);assert.equal(verifyIndex(a.db,index.file,true).status,'ok');
 }finally{await index?.close();a.close();rmSync(dir,{recursive:true,force:true});}
});

test('P8 empty index binds to the first committed archive event on incremental catch-up',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'yuvi-p8-first-event-')),a=new Archive(dir);let index;
 try{index=new ArchiveIndex(a.db,dir);assert.equal(verifyIndex(a.db,index.file).status,'ok');
  const heard=a.append({class:'experience',kind:'heard',actor:'owner',content:'首次回合进行中'});assert.equal(verifyIndex(a.db,index.file).status,'behind');
  index.catchUp();assert.equal(verifyIndex(a.db,index.file,true).status,'ok');assert.equal(index.search('首次回合',-Infinity,Infinity).results[0].seq,heard.seq);
 }finally{await index?.close();a.close();rmSync(dir,{recursive:true,force:true});}
});

test('P8 C9/C10/C11: scope, decoding and query punctuation remain literal and isolated',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'yuvi-p8-boundary-')),a=new Archive(dir);let index;
 try{
  const local=a.append({class:'experience',kind:'heard',actor:'owner',content:'边界年糕 � 🎉 ABC123'});
  a.append({class:'experience',kind:'heard',actor:'owner',scene:'another-scene',content:'年糕 外部场景'});
  a.append({class:'experience',kind:'heard',actor:'owner',branch:'fork:isolated',content:'年糕 外部分支'});
  a.append({class:'control',kind:'error',actor:'system',content:'年糕 控制事件'});
  const silent=a.append({class:'act',kind:'silent',actor:'yuvi',content:''});
  const nul=a.append({class:'experience',kind:'heard',actor:'owner',content:'截断前\0尾后年糕'});
  a.append({class:'inner',kind:'wrote',actor:'yuvi',content:''});index=new ArchiveIndex(a.db,dir);
  assert.deepEqual(index.search('年糕',-Infinity,Infinity).results.map(e=>e.seq),[local.seq]);
  const rows=new DatabaseSync(index.file,{readOnly:true});try{assert.deepEqual(rows.prepare('SELECT seq FROM docs ORDER BY seq').all().map(e=>e.seq),[local.seq,silent.seq,nul.seq]);}finally{rows.close();}
  for(const query of ['"年糕" OR NEAR(猫 叫) AND -x:*','年糕 ^ NOT ( )','\ud800年糕','ＡＢＣ１２３'])assert.ok(index.search(query,-Infinity,Infinity).results.some(e=>e.seq===local.seq),query);
  const {check}=await import('../dist/context.js');
  for(const query of ['�','🎉']){const result=await check(a,JSON.stringify({query}),'负责人',{index});assert.equal(result.meta.engine,'scan');assert.equal(result.meta.fallback,'no_terms');assert.deepEqual(result.meta.result_seqs,[local.seq]);}
  assert.equal(verifyIndex(a.db,index.file,true).status,'ok');
 }finally{await index?.close();a.close();rmSync(dir,{recursive:true,force:true});}
});

test('P8 failed readonly scan worker rejects outstanding work and can be recreated on the next request',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'yuvi-p8-scan-worker-')),a=new Archive(dir);let index;
 try{
  const h=a.append({class:'experience',kind:'heard',actor:'owner',content:'重试只读扫描'});index=new ArchiveIndex(a.db,dir);
  const pending=index.scan('{"query":"扫描"}','负责人','index_building');
  const rejected=assert.rejects(pending,/^Error: Archive scan failed\.$/);await index.scanWorker.terminate();await rejected;
  const result=await index.scan('{"query":"扫描"}','负责人','index_unavailable');assert.deepEqual(result.meta.result_seqs,[h.seq]);
 }finally{await index?.close();a.close();rmSync(dir,{recursive:true,force:true});}
});
