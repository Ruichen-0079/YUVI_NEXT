// Offline, real-service scale probe. All archives and model responses are synthetic.
import { mkdirSync,copyFileSync,writeFileSync,statSync } from 'node:fs';
import { join,resolve } from 'node:path';
import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { performance } from 'node:perf_hooks';
import { setTimeout as delay } from 'node:timers/promises';
import { Archive } from '../../dist/archive.js';
import { ArchiveIndex,buildIndex,verifyIndex } from '../../dist/archive-index.js';
import { check } from '../../dist/context.js';
import { createSnapshot } from '../../dist/snapshots.js';
import { generate } from '../p6/generate.mjs';
import { varied,queries } from './corpus.mjs';
import { startService,legacyCheckout,listen,text,tool,done } from '../../test/helpers/p6-process.mjs';
const [pathArg,...argv]=process.argv.slice(2),root=resolve(pathArg),options=Object.fromEntries(Array.from({length:argv.length/2},(_,i)=>[argv[2*i].replace(/^--/,''),Number(argv[2*i+1])]));
mkdirSync(root,{recursive:false,mode:0o700});const count=options.count??1000000,trials=options.trials??20;
const percentile=(xs,p)=>[...xs].sort((a,b)=>a-b)[Math.max(0,Math.ceil(xs.length*p)-1)];
const stats=xs=>({samples:xs,median_ms:percentile(xs,.5),p95_ms:percentile(xs,.95),p99_ms:percentile(xs,.99),max_ms:Math.max(...xs)});
const result={node:process.version,baseline:'3343efa',count,trials,shapes:{},method:'monotonic performance.now; one warmup then20 samples; immediate loopback fake; service T1/T2/T3/T4 separate model time'};
const save=()=>writeFileSync(join(root,'results.json'),JSON.stringify(result,null,2)+'\n');
const legacy=await legacyCheckout(root,'3343efa');
const hook=join(root,'increment-probe.mjs');writeFileSync(hook,`import{ArchiveIndex}from${JSON.stringify(resolve('dist/archive-index.js'))};const original=ArchiveIndex.prototype.catchUp;ArchiveIndex.prototype.catchUp=function(...args){const start=performance.now();try{return original.apply(this,args);}finally{console.log('P8_INCREMENT '+(performance.now()-start));}};`);let mode='ordinary',currentCalls=[],calls=[];
const fake=createServer(async(req,res)=>{
 const chunks=[];for await(const c of req)chunks.push(c);const body=JSON.parse(Buffer.concat(chunks).toString('utf8')),t2=performance.now();
 const wants=mode==='check'&&!body.messages.some(m=>m.role==='tool');
 if(!body.tools)res.end(text('整理测试材料')+done());
 else if(wants)res.end(tool('check',{query:'重建',from:new Date(Date.now()-300000).toISOString()})+done());
 else res.end(text('正常结束')+done({prompt_tokens:1,completion_tokens:1}));
 const item={t2,t3:performance.now(),consolidation:!body.tools};calls.push(item);currentCalls.push(item);
});const base=await listen(fake);
try{
 for(const shape of ['varied','typical']){
  console.error(JSON.stringify({shape,stage:'generate'}));const dir=join(root,shape);mkdirSync(dir);const data=join(dir,'seed');mkdirSync(data);
  const fixture=generate(join(data,'archive.sqlite'),{count,shape,seed:67});
  createSnapshot({dataDir:data,snapshotDir:join(dir,'snapshots')});
  const shapeResult=result.shapes[shape]={};save();
  // Real entry point builds in a worker while requests and a fixed-rate health probe run.
  console.error(JSON.stringify({shape,stage:'online-build'}));
  const live=join(dir,'live');mkdirSync(live);copyFileSync(join(data,'archive.sqlite'),join(live,'archive.sqlite'));
  const beforeStart=performance.now(),service=await startService(dir,{data:live,baseUrl:base,snapshots:join(dir,'snapshots'),context:200,hook});
  const health=[],healthFailures=[],pendingHealth=new Set();let healthActive=true;
  const timer=setInterval(()=>{if(!healthActive)return;const begin=performance.now();const promise=fetch(service.url+'/health').then(r=>{health.push(performance.now()-begin);if(!r.ok)healthFailures.push(r.status);}).catch(()=>healthFailures.push('connection'));pendingHealth.add(promise);void promise.finally(()=>pendingHealth.delete(promise));},100);
  const turns=[];
  try{
   for(let i=0;i<20;i++){mode=i%4===0?'check':'ordinary';const frames=await service.post('重建期间独立测试'+i);turns.push({last:frames.at(-1).event,elapsed_ms:frames.at(-1).at-frames.sentAt});}
   let position=0;const limit=performance.now()+300000;
   while(performance.now()<limit){
    try{const db=new DatabaseSync(join(live,'index.sqlite'),{readOnly:true});try{position=JSON.parse(db.prepare("SELECT value FROM metadata WHERE key='through_seq'").get().value);}finally{db.close();}}catch{ /* worker may not yet have created metadata */ }
    const archive=new DatabaseSync(join(live,'archive.sqlite'),{readOnly:true});let last;try{last=Number(archive.prepare("SELECT max(seq) n FROM events WHERE kind IN ('heard','said','silent','wrote')").get().n);}finally{archive.close();}
    if(position>=last)break;await delay(100);
   }
   shapeResult.rebuild={elapsed_from_process_start_ms:performance.now()-beforeStart,through_seq:position,health:stats(health),health_failures:healthFailures,turns};
  }finally{healthActive=false;clearInterval(timer);await Promise.allSettled([...pendingHealth]);await service.stop();}
  const liveArchive=new Archive(live);try{shapeResult.rebuild.verification=verifyIndex(liveArchive.db,join(live,'index.sqlite'));}finally{liveArchive.close();}
  save();
  // Independent synchronous empty build measures CPU/wall without HTTP work.
  console.error(JSON.stringify({shape,stage:'empty-build'}));
  const begin=performance.now();buildIndex(data);shapeResult.empty_build_ms=performance.now()-begin;
  let archive=new Archive(data),index=new ArchiveIndex(archive.db,data);
  try{
   const db=new DatabaseSync(index.file,{readOnly:true});try{shapeResult.index={bytes:statSync(index.file).size,archive_bytes:statSync(join(data,'archive.sqlite')).size,documents:Number(db.prepare('SELECT count(*) n FROM docs').get().n),characters:Number(db.prepare('SELECT sum(chars) n FROM docs').get().n),terms:Number(db.prepare('SELECT sum(cnt) n FROM vocab').get().n),schema:db.prepare('SELECT name,sql FROM sqlite_master ORDER BY name').all()};}finally{db.close();}
   shapeResult.queries=[];
   const qs=shape==='varied'?fixture.queries:queries;
   for(const q of qs){
    const samples={index:[],scan:[]};let last;
    for(const engine of ['index','scan'])for(let i=-1;i<trials;i++){
     const args=JSON.stringify({query:q.query,...(Number.isFinite(q.from)?{from:new Date(q.from).toISOString()}:{}),...(Number.isFinite(q.to)?{to:new Date(q.to).toISOString()}:{})});
     const begin=performance.now();last=engine==='index'?(q.kinds?index.search(q.query,q.from??-Infinity,q.to??Infinity,q.kinds):check(archive,args,'负责人',{index})):check(archive,args,'负责人');const elapsed=performance.now()-begin;if(i>=0)samples[engine].push(elapsed);
    }
    shapeResult.queries.push({id:q.id,query:q.query,index:stats(samples.index),scan:stats(samples.scan),expected:q.expected});save();
   }
  }finally{await index.close();archive.close();}
  console.error(JSON.stringify({shape,stage:'ordinary-and-startup'}));mode='ordinary';
  shapeResult.service={};
  for(const [label,checkout]of[['p7',legacy],['p8',resolve('.')]]){
   const s=await startService(dir,{checkout,data,baseUrl:base,snapshots:join(dir,'snapshots'),context:200,...(label==='p8'?{hook}:{})}),program=[],model=[];
   try{
    for(let i=-2;i<trials;i++){currentCalls=[];const frames=await s.post('普通性能测试'+i),heard=frames.find(f=>f.event==='heard'),last=frames.at(-1);if(last.event!=='done')throw Error('Turn failed');if(i>=0){program.push(currentCalls[0].t2-heard.at+last.at-currentCalls.at(-1).t3);model.push(currentCalls.reduce((n,c)=>n+c.t3-c.t2,0));}}
    shapeResult.service[label]={startup_ms:s.startupMs,rss_bytes:await s.rss(),program:stats(program),model:stats(model),...(label==='p8'?{incremental:stats(s.output.split('\n').filter(line=>line.startsWith('P8_INCREMENT ')).map(line=>Number(line.slice(13))))}:{})};
   }finally{await s.stop();}
   save();
  }
  shapeResult.passed={build:shapeResult.empty_build_ms<=300000,health:shapeResult.rebuild.health.p99_ms<=100&&healthFailures.length===0,turns:turns.every(t=>t.last==='done'),ordinary:shapeResult.service.p8.program.p95_ms<100,startup_increment:shapeResult.service.p8.startup_ms-shapeResult.service.p7.startup_ms<=1000,index_size:shape==='typical'||shapeResult.index.bytes<=1.5*shapeResult.index.archive_bytes};save();
 }
 console.log(JSON.stringify(result,null,2));
}finally{await new Promise(r=>fake.close(r));}
