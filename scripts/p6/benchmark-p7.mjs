// Invoked by benchmark.mjs --p7 1. Same real-service/fake-model timing as P6.
import { createServer } from 'node:http';
import { mkdir, copyFile, writeFile, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { spawn } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { generate } from './generate.mjs';
import { createSnapshot } from '../../dist/snapshots.js';
import { legacyCheckout, listen, startService, text, tool, done } from '../../test/helpers/p6-process.mjs';
const [directory,...args]=process.argv.slice(2),opt=Object.fromEntries(Array.from({length:args.length/2},(_,i)=>[args[i*2].replace(/^--/,''),Number(args[i*2+1])]));
const root=resolve(directory);await mkdir(root,{recursive:false,mode:0o700});
const count=opt.count??1_000_000,ordinary=opt.ordinary??60,checks=opt.checks??20,pressure=opt.pressure??40;
const out={node:process.version,baseline_ref:'9f67b81',count,configuration:{ordinary,checks,pressure},timing:'P6 T1/T2/T3/T4; performance.now; immediate loopback fake; instrumented assembly/hash/commit also reported',shapes:{}};
const quantile=(a,p)=>[...a].sort((x,y)=>x-y)[Math.max(0,Math.ceil(a.length*p)-1)];
function stats(a){return {samples:a.length,median_ms:quantile(a,.5),p95_ms:quantile(a,.95),max_ms:Math.max(...a)};}
const legacy=await legacyCheckout(root,'9f67b81');
let calls=[],check=false,empty=false;
const fake=createServer(async(req,res)=>{const chunks=[];for await(const c of req)chunks.push(c);const body=JSON.parse(Buffer.concat(chunks).toString('utf8')),call={t2:performance.now(),consolidation:!body.tools};calls.push(call);
 res.end(!body.tools?(empty?'':text('整理原文'))+done({prompt_tokens:1}):check&&!body.messages.some(m=>m.role==='tool')?tool('check',{query:check})+done({prompt_tokens:1}):text('答复原文')+done({prompt_tokens:1,completion_tokens:1}));call.t3=performance.now();});
const base=await listen(fake);
const hook=join(root,'metrics.mjs');
await writeFile(hook,`import{registerHooks,syncBuiltinESMExports}from'node:module';import{DatabaseSync}from'node:sqlite';import crypto from'node:crypto';
 globalThis.__p7={assembly_ms:0,hash_ms:0,manifest_json_ms:0};
 const stringify=JSON.stringify;JSON.stringify=function(value,...rest){const t=performance.now();try{return stringify(value,...rest);}finally{if(value?.rules==='p7'&&value?.format===1)globalThis.__p7.manifest_json_ms+=performance.now()-t;}};
 const hash=crypto.createHash;crypto.createHash=function(...a){const begin=performance.now(),h=hash(...a);globalThis.__p7.hash_ms+=performance.now()-begin;for(const key of ['update','digest']){const f=h[key];h[key]=function(...v){const t=performance.now();try{return f.apply(this,v);}finally{globalThis.__p7.hash_ms+=performance.now()-t;}};}return h;};syncBuiltinESMExports();
 const prepare=DatabaseSync.prototype.prepare;DatabaseSync.prototype.prepare=function(sql){const st=prepare.call(this,sql);if(sql.includes('INSERT INTO events')){const run=st.run;st.run=function(...a){const t=performance.now();const result=run.apply(this,a),write=performance.now()-t;if(a[3]==='presented'){const m=JSON.parse(a.at(-1));console.log('P7_METRIC '+JSON.stringify({...globalThis.__p7,write_ms:write,bytes:Buffer.byteLength(a.at(-1)),purpose:m.purpose,step:m.step}));globalThis.__p7={assembly_ms:0,hash_ms:0,manifest_json_ms:0};}return result;};}return st;};
 registerHooks({load(url,context,next){const r=next(url,context);if(url.endsWith('/context.js')){let s=String(r.source);const legacy=url.includes('/legacy/');for(const name of legacy?['dialogueMessages','consolidationMessages']:['assembleContext','selectDialogue','selectConsolidation']){s=s.replace('export function '+name+'(', 'function measured_'+name+'(');s+='\\nexport function '+name+'(...args){const t=performance.now();try{return measured_'+name+'(...args);}finally{globalThis.__p7.assembly_ms+=performance.now()-t;}}';}return {...r,source:s};}if(url.includes('/legacy/')&&url.endsWith('/model.js')){let s=String(r.source).replace('export async function streamModel(', 'async function measured_streamModel(');s+='\\nexport function streamModel(...args){console.log(\"P7_METRIC \"+JSON.stringify({...globalThis.__p7,write_ms:0}));globalThis.__p7={assembly_ms:0,hash_ms:0,manifest_json_ms:0};return measured_streamModel(...args);}';return {...r,source:s};}return r;}});`);
async function run(service,label){const start=calls.length,frames=await service.post(label),cs=calls.slice(start),t1=frames.find(f=>f.event==='heard').at,t4=frames.at(-1).at;
 if(frames.at(-1).event!=='done')throw Error('No successful final frame');
 return {t1,t4,calls:cs,program_ms:cs[0].t2-t1+t4-cs.at(-1).t3,model_ms:cs.reduce((n,c)=>n+c.t3-c.t2,0)};}
function metricLines(output){return output.split('\n').filter(s=>s.startsWith('P7_METRIC ')).map(s=>JSON.parse(s.slice(10)));}
try{
 for(const shape of ['typical','empty']){
  empty=shape==='empty';console.error(JSON.stringify({shape,stage:'generate'}));const seed=join(root,shape,'seed');await mkdir(seed,{recursive:true});generate(join(seed,'archive.sqlite'),{count,shape,seed:67});
  const snapshots=join(root,shape,'snapshots');createSnapshot({dataDir:seed,snapshotDir:snapshots});
  const shapeOut=out.shapes[shape]={};
  for(const [label,checkout] of [['baseline',legacy],['p7',resolve('.')]]){
   console.error(JSON.stringify({shape,stage:label}));const result=shapeOut[label]={raw:[],instrumentation:[]};
   for(const n of [200,20]){
    const data=join(root,shape,label+'-'+n);await mkdir(data,{recursive:true});await copyFile(join(seed,'archive.sqlite'),join(data,'archive.sqlite'));
    const service=await startService(root,{data,checkout,baseUrl:base,context:n,snapshots,hook});
    const runs=[],ordinaryRuns=[],checkTimes={common:[],absent:[]};
    result['startup_'+n+'_ms']=service.startupMs;result['rss_'+n+'_start_bytes']=await service.rss();
    try{
     check=false;
     if(n===200){let i=0;while(ordinaryRuns.length<ordinary){const r=await run(service,'普通-'+i++);runs.push(r);if(!r.calls.some(c=>c.consolidation))ordinaryRuns.push(r);}
      for(const group of ['common','absent'])for(let j=0;j<checks/2;j++){check=group==='common'?'散步':'不存在-qzxv-absent';const r=await run(service,'查档-'+group+j);runs.push(r);const ds=r.calls.filter(c=>!c.consolidation);if(ds.length!==2)throw Error('Expected check continuation');checkTimes[group].push(ds[1].t2-ds[0].t3);}
      result.ordinary_program=stats(ordinaryRuns.map(r=>r.program_ms));result.model=stats(ordinaryRuns.map(r=>r.model_ms));result.check_common=stats(checkTimes.common);result.check_absent=stats(checkTimes.absent);
     }else{for(let i=0;i<pressure;i++)runs.push(await run(service,'压力-'+i));result.consolidation_build=stats(runs.filter(r=>r.calls[0].consolidation).map(r=>r.calls[0].t2-r.t1));}
     result['rss_'+n+'_end_bytes']=await service.rss();
    }finally{await service.stop();}
    result['turn_count_'+n]=runs.length;result['archive_growth_'+n+'_bytes']=(await stat(join(data,'archive.sqlite'))).size-(await stat(join(seed,'archive.sqlite'))).size;
    result.raw.push(...runs);result.instrumentation.push(...metricLines(service.output));
    if(label==='p7'){
     const db=new DatabaseSync(join(data,'archive.sqlite'),{readOnly:true});const rows=db.prepare("SELECT meta,length(CAST(meta AS BLOB)) bytes FROM events WHERE seq>? AND kind='presented'").all(count);db.close();
     result.presented_sizes??={dialogue_zero:[],tool_steps:[],consolidation:[]};for(const r of rows){const m=JSON.parse(r.meta);result.presented_sizes[m.purpose==='consolidation'?'consolidation':m.step===0?'dialogue_zero':'tool_steps'].push(Number(r.bytes));}
    }
   }
  }
  const b=shapeOut.baseline,p=shapeOut.p7;
  shapeOut.increment={ordinary_median_ms:p.ordinary_program.median_ms-b.ordinary_program.median_ms,ordinary_p95_ms:p.ordinary_program.p95_ms-b.ordinary_program.p95_ms,
   per_request_assembly_ms:stats(p.instrumentation.map((m,i)=>m.assembly_ms+m.write_ms+(m.manifest_json_ms??0)-(b.instrumentation[i]?.assembly_ms??0))),
   measured_assembly_ms:stats(p.instrumentation.map(m=>m.assembly_ms)),manifest_json_ms:stats(p.instrumentation.map(m=>m.manifest_json_ms??0)),hash_ms:stats(p.instrumentation.map(m=>m.hash_ms)),write_ms:stats(p.instrumentation.map(m=>m.write_ms))};
  shapeOut.storage={};for(const [key,sizes]of Object.entries(p.presented_sizes))shapeOut.storage[key]={samples:sizes.length,median_bytes:quantile(sizes,.5),maximum_bytes:Math.max(...sizes)};
  shapeOut.storage.estimated_daily_200_single_step_meta_bytes=200*shapeOut.storage.dialogue_zero.median_bytes;
  shapeOut.storage.estimated_daily_200_meta_bytes_observed_mix=200/p.presented_sizes.dialogue_zero.length*Object.values(p.presented_sizes).flat().reduce((n,v)=>n+v,0);
  shapeOut.storage.observed_extra_archive_bytes_per_200_turns=200*(p.archive_growth_200_bytes-b.archive_growth_200_bytes)/p.turn_count_200;
  shapeOut.passed={ordinary:p.ordinary_program.p95_ms<100,per_request_increment:shapeOut.increment.per_request_assembly_ms.p95_ms<=10,default_zero_bytes:shapeOut.storage.dialogue_zero.maximum_bytes<=1500};
  await writeFile(join(root,'results.json'),JSON.stringify(out,null,2));
 }
 console.error(JSON.stringify({stage:'generate-presented-million'}));const file=join(root,'presented','archive.sqlite');const genStart=performance.now();out.presented_generation=generate(file,{count,shape:'presented',seed:67});out.presented_generation_ms=performance.now()-genStart;
 out.diagnostics={};const rssHook=join(root,'diagnostic-rss.mjs');await writeFile(rssHook,"process.on('exit',()=>console.error('P7_MAX_RSS_KB='+process.resourceUsage().maxRSS));");
 for(const command of ['summary','writings']){
  const start=performance.now();const child=spawn(process.execPath,['--import',rssHook,'dist/maintenance.js','presented',command],{env:{...process.env,YUVI_DATA_DIR:join(root,'presented')},stdio:['ignore','pipe','pipe']});
  let output='',stderr='';
  child.stdout.on('data',s=>output+=s);child.stderr.on('data',s=>stderr+=s);const exit=await new Promise(r=>child.once('close',r));
  const rss=Number(/P7_MAX_RSS_KB=(\d+)/.exec(stderr)?.[1])*1024;
  if(exit!==0)throw Error('Diagnostic failed');const data=JSON.parse(output);out.diagnostics[command]={elapsed_ms:performance.now()-start,peak_rss_bytes:rss,rss_method:'Node process.resourceUsage().maxRSS at exit (KiB to bytes)',
   ...(command==='summary'?{result:data}:{writing_rows:data.writings.length,never_presented:data.never_presented}),passed:performance.now()-start<30000&&rss<400_000_000};
 }
 await writeFile(join(root,'results.json'),JSON.stringify(out,null,2));console.log(JSON.stringify(out,null,2));
 if(Object.values(out.shapes).some(s=>Object.values(s.passed).some(v=>!v))||Object.values(out.diagnostics).some(v=>!v.passed))process.exitCode=1;
}finally{const closed=new Promise(r=>fake.close(r));fake.closeAllConnections();await closed;}
