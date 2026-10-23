import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { Archive } from '../dist/archive.js';
import { ArchiveIndex,buildIndex,terms } from '../dist/archive-index.js';
import { varied } from '../scripts/p8/corpus.mjs';

test('P8 R1–R30: deterministic 50000-event corpus and declared retrieval expectations',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'yuvi-p8-r-'));let a,index;
 try{
  const fixture=varied(join(dir,'archive.sqlite'));a=new Archive(dir);buildIndex(dir);index=new ArchiveIndex(a.db,dir);
  for(const q of fixture.queries)await t.test(q.id,()=>{
   if(q.id==='R17'){assert.deepEqual(terms(q.query,true),[]);assert.ok(a.search(q.query,-Infinity,Infinity).results.some(e=>e.seq===fixture.targets.T13));return;}
   const r=index.search(q.query,q.from??-Infinity,q.to??Infinity,q.kinds);assert.ok(!('fallback'in r),q.id);
   for(const target of q.expected)assert.ok(r.results.some(e=>e.seq===fixture.targets[target]),q.id+' '+target);
   if(['R13','R20','R21'].includes(q.id))assert.equal(r.total,0,q.id);
   if(q.id==='R9')assert.equal(r.meta.rank_seqs[0],fixture.targets.T6);
   if(q.id==='R10')assert.equal(a.search(q.query,-Infinity,Infinity).total,0);
   if(['R23','R28'].includes(q.id)){
    const db=new DatabaseSync(index.file,{readOnly:true});try{
     const clause=q.query?'terms MATCH ? AND ':'';
     const ranked=db.prepare(`SELECT d.seq,d.chars FROM ${q.query?'terms f JOIN docs d ON d.seq=f.rowid':'docs d'} WHERE ${clause} d.t_recorded>=? AND d.t_recorded<=? ORDER BY ${q.query?'f.rank,f.rowid DESC':'d.seq DESC'}`).all(...(q.query?['"糖葫" OR "葫芦"']:[]),q.from??-Infinity,q.to??Infinity);
     assert.deepEqual(r.meta.rank_seqs,ranked.slice(0,100).map(e=>e.seq));
     const chosen=[ranked[0]];
     if(q.query){const newest=ranked.reduce((a,b)=>a.seq>b.seq?a:b);if(newest.seq!==chosen[0].seq)chosen.push(newest);}
     let chars=chosen.reduce((n,e)=>n+e.chars,0);
     for(const e of ranked){if(chosen.some(c=>c.seq===e.seq))continue;if(chosen.length===40||chars+e.chars>16000)break;chosen.push(e);chars+=e.chars;}
     assert.deepEqual(r.results.map(e=>e.seq),chosen.map(e=>e.seq).sort((a,b)=>a-b));
    }finally{db.close();}
    if(q.id==='R23')assert.equal(r.total,60);
   }
   if(q.id==='R24')assert.equal(r.meta.mode,'relevance');
   if(q.id==='R26')assert.ok(r.meta.terms.length<=32);
   if(q.id==='R30')assert.equal(index.search('年糕',-Infinity,Infinity,['wrote']).total,0);
  });
 }finally{await index?.close();a?.close();rmSync(dir,{recursive:true,force:true});}
});
