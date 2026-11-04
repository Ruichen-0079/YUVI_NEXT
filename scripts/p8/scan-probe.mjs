// Real P8 readonly-worker path versus unchanged P6 scan, same archive/query.
import { Archive } from '../../dist/archive.js';
import { ArchiveIndex } from '../../dist/archive-index.js';
import { check } from '../../dist/context.js';
import { writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const [directory,out]=process.argv.slice(2),a=new Archive(directory),index=new ArchiveIndex(a.db,directory),samples={worker:[],scan:[]},query='🎉',raw=JSON.stringify({query});
const p95=xs=>[...xs].sort((a,b)=>a-b)[Math.ceil(xs.length*.95)-1];let expected;
try{
 for(let i=-1;i<20;i++)for(const path of ['scan','worker']){
  const begin=performance.now(),r=await (path==='worker'?check(a,raw,'负责人',{index,scan:(args,owner,reason)=>index.scan(args,owner,reason)}):check(a,raw,'负责人'));
  if(i>=0)samples[path].push(performance.now()-begin);const selection={total:r.meta.total,result_seqs:r.meta.result_seqs};
  if(expected)assert.deepEqual(selection,expected);else expected=selection;
  if(path==='worker'){assert.equal(r.meta.engine,'scan');assert.equal(r.meta.fallback,'no_terms');}
 }
 const result={node:process.version,query,actual_engine:'scan',fallback:'no_terms',samples,p95_ms:{worker:p95(samples.worker),scan:p95(samples.scan)},same_semantics:true,selection:expected};
 result.ratio=result.p95_ms.worker/result.p95_ms.scan;result.within_1_25=result.ratio<=1.25;result.threshold_status='Measured without semantic changes; mandatory status awaits Claude final spec review per owner instruction';
 writeFileSync(out,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({p95_ms:result.p95_ms,ratio:result.ratio,within_1_25:result.within_1_25}));
}finally{await index.close();a.close();}
