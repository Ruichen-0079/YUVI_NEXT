import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,readFileSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { measure } from '../eval/measure.mjs';

test('P8 E2/E3/E5/E7: first14d A0/A2 twice, real idle/pressure consolidation, independent deterministic metrics',()=>{
 const root=mkdtempSync(join(tmpdir(),'yuvi-p8-eval-')),wall=performance.now();
 try{
  for(const arm of ['A0','A2']){
   let expected;
   for(let i=0;i<2;i++){
    const out=join(root,arm+'-'+i),run=spawnSync(process.execPath,['eval/run.mjs','life-a',arm,out,'14','excerpt'],{env:{...process.env,TZ:'Asia/Shanghai'},encoding:'utf8',timeout:80000});
    assert.equal(run.status,0,run.stderr);const m=measure(out);
    assert.ok(m.sanity.every(p=>p.all_presented));assert.equal(m.sanity.length,2);assert.equal(m.reasons.unexplained,0);
    assert.ok(m.consolidation.idle>0);assert.ok(m.consolidation.pressure>0);assert.ok(m.consolidation.wrote>0);
    const driver=JSON.parse(readFileSync(join(out,'run.json'),'utf8'));assert.equal(m.consolidation.idle,driver.idle_consolidations);assert.equal(m.consolidation.pressure,driver.pressure_consolidations);
    const bytes=readFileSync(join(out,'metrics.json'),'utf8');if(expected)assert.equal(bytes,expected);else expected=bytes;
   }
  }
  assert.ok(performance.now()-wall<90000,'The four-run fast regression exceeds 90 seconds');
 }finally{rmSync(root,{recursive:true,force:true});}
});
