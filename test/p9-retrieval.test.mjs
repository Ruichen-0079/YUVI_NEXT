import {test} from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';import {join} from 'node:path';import {tmpdir} from 'node:os';
import {Archive} from '../dist/archive.js';import {ArchiveIndex,buildIndex} from '../dist/archive-index.js';import {check} from '../dist/context.js';import {writings} from '../scripts/p9/corpus.mjs';
test('P9 W1–W11: frozen 50000-event writings corpus',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'yuvi-p9-w-'));let a,index;
 try{const f=writings(join(dir,'archive.sqlite'));a=new Archive(dir);buildIndex(dir);index=new ArchiveIndex(a.db,dir);
  for(const q of f.queries)await t.test(q.id,async()=>{
   const params={query:q.query,...(q.from?{from:new Date(q.from).toISOString(),to:new Date(q.to).toISOString()}: {})};
   const r=await check(a,JSON.stringify(params),'负责人',{index,tool:'recall'}),m=r.meta;
   for(const target of q.expected)assert.ok(m.result_seqs.includes(f.targets[target]),q.id+' '+target);
   for(const seq of [...m.result_seqs,...m.rank_seqs]){const e=a.db.prepare('SELECT * FROM events WHERE seq=?').get(seq);assert.equal(e.kind,'wrote');assert.equal(e.class,'inner');assert.equal(e.scene,'web');assert.equal(e.branch,'dev:v2-dev');assert.ok(e.content);}
   if(q.id==='W1'){assert.equal(m.total,1);assert.equal((await check(a,'{"query":"年糕"}','负责人',{index})).meta.total,2);}
   if(q.id==='W3'){assert.equal(m.total,0);assert.deepEqual(m.rank_seqs,[]);assert.equal((await check(a,JSON.stringify(params),'负责人',{index})).meta.total,0);}
   if(q.id==='W4'){assert.equal(m.result_seqs.length,10);assert.ok(!m.result_seqs.includes(f.targets.WT4));}
   if(q.id==='W5')assert.deepEqual(m.result_seqs,[f.targets.WT5]);
   if(q.id==='W6'){assert.equal(m.engine,'scan');assert.equal(m.fallback,'no_terms');assert.deepEqual(m.result_seqs,[f.targets.WT7]);}
   if(q.id==='W7')assert.equal(m.rank_seqs[0],f.targets.WT8);
   if(q.id==='W9'){assert.equal(m.total,0);assert.ok((await check(a,JSON.stringify(params),'负责人',{index})).meta.result_seqs.includes(f.targets.HT10));}
   if(q.id==='W10'){assert.equal(m.total,21);assert.equal(m.result_seqs.length,10);assert.ok(m.result_seqs.includes(m.rank_seqs[0]));assert.ok(m.result_seqs.includes(f.targets.WT8x19));assert.deepEqual(m.result_seqs,[...m.result_seqs].sort((a,b)=>a-b));}
  });
 }finally{await index?.close();a?.close();rmSync(dir,{recursive:true,force:true});}
});
