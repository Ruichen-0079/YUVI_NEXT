import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Archive } from '../dist/archive.js';
import { ArchiveIndex,buildIndex,terms } from '../dist/archive-index.js';
import { varied } from '../scripts/p8/corpus.mjs';

test('P8 R1–R30: deterministic 50000-event corpus and declared retrieval expectations',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'yuvi-p8-r-'));let a,index;
 try{
  const fixture=varied(join(dir,'archive.sqlite'));a=new Archive(dir);buildIndex(dir);index=new ArchiveIndex(a.db,dir);
  for(const q of fixture.queries){
   if(q.id==='R17'){assert.deepEqual(terms(q.query,true),[]);assert.ok(a.search(q.query,-Infinity,Infinity).results.some(e=>e.seq===fixture.targets.T13));continue;}
   const r=index.search(q.query,q.from??-Infinity,q.to??Infinity,q.kinds);assert.ok(!('fallback'in r),q.id);
   for(const target of q.expected)assert.ok(r.results.some(e=>e.seq===fixture.targets[target]),q.id+' '+target);
   if(['R13','R20','R21'].includes(q.id))assert.equal(r.total,0,q.id);
   if(q.id==='R9')assert.equal(r.meta.rank_seqs[0],fixture.targets.T6);
   if(q.id==='R10')assert.equal(a.search(q.query,-Infinity,Infinity).total,0);
   if(q.id==='R23'){assert.equal(r.total,60);assert.equal(r.results.length,40);}
   if(q.id==='R26')assert.ok(r.meta.terms.length<=32);
   if(q.id==='R30')assert.equal(index.search('年糕',-Infinity,Infinity,['wrote']).total,0);
  }
 }finally{await index?.close();a?.close();rmSync(dir,{recursive:true,force:true});}
});
