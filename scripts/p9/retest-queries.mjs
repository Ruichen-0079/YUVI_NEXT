// Reuse only synthetic scale archives after bounded rank-source validation.
import {readFileSync,writeFileSync} from 'node:fs';import {join,resolve} from 'node:path';import {performance} from 'node:perf_hooks';import {Archive} from '../../dist/archive.js';import {ArchiveIndex} from '../../dist/archive-index.js';import {check} from '../../dist/context.js';
const [p9Arg,p8Arg,outArg]=process.argv.slice(2),p9=resolve(p9Arg),p8=resolve(p8Arg),out=resolve(outArg),trials=20,result={node:process.version,trials,method:'one warmup; per-query p95; retained synthetic scale archives; bounded rank-source checks enabled',cases:{}};
const stats=a=>({samples:a,p95_ms:[...a].sort((a,b)=>a-b)[Math.ceil(a.length*.95)-1],max_ms:Math.max(...a)});
for(const [label,root,shape,recall]of [['writings',p9,'writings',true],['varied-check',p8,'varied',false]]){
 const previous=JSON.parse(readFileSync(join(root,'results.json'),'utf8')),fixture=previous.shapes[shape].fixture??JSON.parse(readFileSync(join(p9,'results.json'),'utf8')).shapes.varied.fixture,dir=join(root,shape,recall?'data':'seed'),a=new Archive(dir),index=new ArchiveIndex(a.db,dir);const rows=[];
 try{for(const q of fixture.queries){
  const raw=JSON.stringify({query:q.query,...(Number.isFinite(q.from)?{from:new Date(q.from).toISOString()}:{}),...(Number.isFinite(q.to)?{to:new Date(q.to).toISOString()}:{})}),samples=[],scan=[];let response;
  for(let i=-1;i<trials;i++){let at=performance.now();response=q.kinds&&!recall?index.search(q.query,q.from??-Infinity,q.to??Infinity,q.kinds):await check(a,raw,'负责人',{index,...(recall?{tool:'recall'}:{}),scan:(raw,owner,why,tool)=>index.scan(raw,owner,why,tool)});if(i>=0)samples.push(performance.now()-at);
   if(response.meta.engine==='scan'){at=performance.now();const original=recall?await check(a,raw,'负责人',{engine:'scan',tool:'recall'}):check(a,raw,'负责人');if(i>=0)scan.push(performance.now()-at);if(original.meta.total!==response.meta.total||JSON.stringify(original.meta.result_seqs)!==JSON.stringify(response.meta.result_seqs))throw Error('Scan mismatch');}}
  rows.push({id:q.id,engine:response.meta.engine,...stats(samples),...(scan.length?{original:stats(scan),ratio:stats(samples).p95_ms/stats(scan).p95_ms}: {})});
 }}finally{await index.close();a.close();}result.cases[label]=rows;
}
writeFileSync(out,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({out,cases:Object.fromEntries(Object.entries(result.cases).map(([k,v])=>[k,v.length]))}));
