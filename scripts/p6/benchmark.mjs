// Offline, real-entry-point performance driver. Defaults implement P6 F5.
// node scripts/p6/benchmark.mjs <new scratch directory> [--count 1000000]
import { createServer } from 'node:http';
import { mkdir, copyFile, writeFile, readFile } from 'node:fs/promises';
import { statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { performance } from 'node:perf_hooks';
import { setTimeout as delay } from 'node:timers/promises';
import { generate } from './generate.mjs';
import { createSnapshot } from '../../dist/snapshots.js';
import { legacyCheckout, listen, startService, text, tool, done } from '../../test/helpers/p6-process.mjs';
import { recoveryChecks } from './recovery.mjs';
const [directory,...args]=process.argv.slice(2),options=Object.fromEntries(Array.from({length:args.length/2},(_,i)=>[args[i*2].replace(/^--/,''),Number(args[i*2+1])]));
if(!directory)throw Error('Use a new scratch directory');
const root=resolve(directory);await mkdir(root,{recursive:false,mode:0o700});
const count=options.count??1_000_000,ordinary=options.ordinary??60,checks=options.checks??20,pressure=options.pressure??40,idle=options['idle-seconds']??60,baselineTurns=options['baseline-turns']??1;
const results={node:process.version,baseline_ref:'190a272',rss_scope:'main service process',count,configuration:{ordinary,checks,pressure,idle_seconds:idle,baseline_turns:baselineTurns},shapes:{}};
const legacy=await legacyCheckout(root);let active=null,mode='normal',empty=false,requests=[],hangReply,hangConsolidation;
const fake=createServer(async(req,res)=>{
  let raw='';for await(const part of req)raw+=part;const body=JSON.parse(raw);
  const call={body,t2:performance.now(),t3:null,active};requests.push(call);
  if((!body.tools&&mode==='hang-consolidation')||(body.tools&&mode==='hang-reply')){
    res.writeHead(200,{'Content-Type':'text/event-stream'});
    if(body.tools){res.write(text('已推出'));hangReply?.(call);}else{res.flushHeaders();hangConsolidation?.(call);}return;
  }
  let payload;
  if(!body.tools)payload=(empty?'':text('合成整理原文'))+done({prompt_tokens:1,completion_tokens:1});
  else if(mode==='check'&&!body.messages.some(m=>m.role==='tool'))payload=tool('check',{query:active.query})+done({prompt_tokens:1});
  else payload=text('答复原文')+done({prompt_tokens:1,completion_tokens:1});
  res.end(payload);call.t3=performance.now();
});
const base=await listen(fake);
function metrics(values){const v=[...values].sort((a,b)=>a-b),q=p=>v[Math.max(0,Math.ceil(v.length*p)-1)];return {samples:v.length,min_ms:q(0),median_ms:q(.5),p95_ms:q(.95),p99_ms:q(.99),max_ms:q(1)};}
function announce(shape,stage){console.error(JSON.stringify({shape,stage}));}
async function copySeed(seed,target){await mkdir(target,{recursive:true});await copyFile(join(seed,'archive.sqlite'),join(target,'archive.sqlite'));}
async function turn(service,label,query){active={label,query};const start=requests.length;const frames=await service.post(label);const calls=requests.slice(start);
  const heard=frames.find(f=>f.event==='heard'),end=frames.findLast(f=>['done','silent'].includes(f.event));
  if(!heard||!end)throw Error('No successful terminal SSE');
  return {label,query,sent:frames.sentAt,t1:heard.at,t4:end.at,calls:calls.map(c=>({t2:c.t2,t3:c.t3,consolidation:!c.body.tools})),frames,captured:calls};}
function timing(run){const calls=run.calls,first=calls[0],last=calls.at(-1);const model=calls.reduce((sum,c)=>sum+c.t3-c.t2,0);return {program:(first.t2-run.t1)+(run.t4-last.t3),model,wallProgram:run.t4-run.sent-model};}
try {
 for(const shape of ['typical','empty']){
  empty=shape==='empty';announce(shape,'generate');const seed=join(root,shape,'seed');await mkdir(seed,{recursive:true});
  const generationStart=performance.now(),generation=generate(join(seed,'archive.sqlite'),{count,seed:67,shape});
  const out=results.shapes[shape]={generation,generation_ms:performance.now()-generationStart,size_bytes:statSync(join(seed,'archive.sqlite')).size};
  // A genuine pre-existing recent snapshot avoids measuring a simultaneous first-copy
  // job. P3 integrity and automatic-snapshot verification still run, unchanged.
  const snapshots=join(root,shape,'snapshots');createSnapshot({dataDir:seed,snapshotDir:snapshots});
  const baseline=join(root,shape,'baseline');await copySeed(seed,baseline);
  announce(shape,'old-startup-and-real-turn');mode='normal';let service=await startService(root,{checkout:legacy,data:baseline,baseUrl:base,context:200,snapshots});
  try{
   out.old={startup_ms:service.startupMs,rss_after_start_bytes:await service.rss(),turns:[]};
   for(let i=0;i<baselineTurns;i++){const run=await turn(service,'旧版普通-'+i);out.old.turns.push({program_ms:timing(run).program,model_ms:timing(run).model,wall_program_ms:timing(run).wallProgram,consolidations:run.calls.filter(c=>c.consolidation).length});}
   out.old.rss_after_turns_bytes=await service.rss();
  }finally{await service.stop();}
  const data=join(root,shape,'new-200');await copySeed(seed,data);
  announce(shape,'new-200');service=await startService(root,{data,baseUrl:base,context:200,snapshots});
  const runs=[];
  try{
   out.new={startup_ms:service.startupMs,rss_after_start_bytes:await service.rss()};
   const ordinaryRuns=[];let i=0;
   while(ordinaryRuns.length<ordinary){const run=await turn(service,'普通-'+i++);runs.push(run);if(!run.calls.some(c=>c.consolidation))ordinaryRuns.push(run);}
   const checkGroups={common:[],absent:[]};mode='check';
   for(const group of ['common','absent'])for(let i=0;i<checks/2;i++){
    const run=await turn(service,'查档-'+group+'-'+i,group==='common'?'散步':'不存在的稀有词-qzxv-absent');runs.push(run);
    const dialogue=run.calls.filter(c=>!c.consolidation);if(dialogue.length!==2)throw Error('Expected one check and continuation');
    checkGroups[group].push(dialogue[1].t2-dialogue[0].t3);
   }
   out.new.ordinary_program=metrics(ordinaryRuns.map(r=>timing(r).program));out.new.ordinary_model=metrics(ordinaryRuns.map(r=>timing(r).model));out.new.wall_program=metrics(ordinaryRuns.map(r=>timing(r).wallProgram));
   out.new.check_common=metrics(checkGroups.common);out.new.check_absent=metrics(checkGroups.absent);
   out.new.all_model=metrics(runs.flatMap(r=>r.calls.map(c=>c.t3-c.t2)));
   out.new.rss_after_turns_bytes=await service.rss();
   mode='normal';active=null;announce(shape,'idle-health');const health=[],began=performance.now();
   for(let i=0;i<idle*10;i++){
    await delay(Math.max(0,began+(i+1)*100-performance.now()));const t=performance.now();const response=await fetch(service.url+'/health');await response.json();health.push(performance.now()-t);
   }
   out.new.idle_health=metrics(health);
  }finally{await service.stop();}
  const pressureData=join(root,shape,'new-20');await copySeed(seed,pressureData);
  announce(shape,'new-20-pressure');service=await startService(root,{data:pressureData,baseUrl:base,context:20,snapshots});
  const pressureRuns=[];out.new.pressure_rss_after_start_bytes=await service.rss();
  try{for(let i=0;i<pressure;i++)pressureRuns.push(await turn(service,'压力-'+i));
   out.new.consolidation_build=metrics(pressureRuns.filter(r=>r.calls[0].consolidation).map(r=>r.calls[0].t2-r.t1));
   out.new.pressure_rss_after_startup_and_turns_bytes=await service.rss();
  }finally{await service.stop();}
  out.new.query_plans=[];
  const db=new DatabaseSync(join(seed,'archive.sqlite'),{readOnly:true});
  for(const sql of [
   'SELECT * FROM events WHERE seq IN (1,2,3) ORDER BY seq',
   "SELECT count(*) FROM events NOT INDEXED WHERE scene='web' AND branch='dev:v2-dev' AND instr(content,'散步')>0",
   "SELECT * FROM events NOT INDEXED WHERE scene='web' AND branch='dev:v2-dev' AND instr(content,'散步')>0 ORDER BY seq DESC LIMIT 40"])
   out.new.query_plans.push({sql,plan:db.prepare('EXPLAIN QUERY PLAN '+sql).all()});db.close();
  out.new.passed={ordinary_program:out.new.ordinary_program.p95_ms<100,consolidation_build:out.new.consolidation_build.p95_ms<100,
    idle_health:out.new.idle_health.p99_ms<50,check_common:out.new.check_common.p95_ms<1000,check_absent:out.new.check_absent.p95_ms<1000,
    rss:Math.max(out.new.rss_after_start_bytes,out.new.rss_after_turns_bytes,out.new.pressure_rss_after_start_bytes,out.new.pressure_rss_after_startup_and_turns_bytes)<400_000_000};
  out.raw_timings=runs.map(r=>({label:r.label,sent:r.sent,t1:r.t1,t4:r.t4,calls:r.calls}));out.pressure_raw=pressureRuns.map(r=>({label:r.label,sent:r.sent,t1:r.t1,t4:r.t4,calls:r.calls}));
  await writeFile(join(root,'results.json'),JSON.stringify(results,null,2));announce(shape,'completed');
 }
 if(!options['skip-recovery']){
  announce('typical','million-event-recovery');mode='normal';empty=false;
  results.recovery=await recoveryChecks({root,data:join(root,'typical','new-200'),base,snapshots:join(root,'typical','snapshots'),
    get requests(){return requests;},setMode:value=>{mode=value;},setHangReply:fn=>{hangReply=fn;},setHangConsolidation:fn=>{hangConsolidation=fn;},turn});
 }
 await writeFile(join(root,'results.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
 if(Object.values(results.shapes).some(s=>Object.values(s.new.passed).some(v=>!v)))process.exitCode=1;
}catch(error){await writeFile(join(root,'incomplete-results.json'),JSON.stringify({...results,error:String(error)},null,2));throw error;}
finally{const closed=new Promise(r=>fake.close(r));fake.closeAllConnections();await closed;}
