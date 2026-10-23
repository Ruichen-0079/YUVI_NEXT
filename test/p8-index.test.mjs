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
