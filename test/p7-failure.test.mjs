import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, mkdir, rm, writeFile, readdir, stat, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { DatabaseSync } from 'node:sqlite';
import { Archive } from '../dist/archive.js';
import { createSnapshot, restoreSnapshot } from '../dist/snapshots.js';
import { presentedShow } from '../dist/presented.js';
import { legacyCheckout, listen, startService, text, tool, done } from './helpers/p6-process.mjs';
import { normaliseP7Events, withoutRecordedTime } from './helpers/p7-equivalence.mjs';
import { capturePresentation, digest, readEvents, assertPresentations, cliPresented } from './helpers/p7-records.mjs';
async function until(fn,ms=10000){const end=performance.now()+ms;while(performance.now()<end){if(await fn())return;await delay(20);}throw Error('probe timeout');}

test('G5: P6/P7 500, unavailable, SIGKILL before/after delta, consolidation kill/retry, disconnected browser', async t=>{
 const root=await mkdtemp(join(tmpdir(),'yuvi-p7-failure-')),legacy=await legacyCheckout(root,'9f67b81');
 t.after(()=>rm(root,{recursive:true,force:true,maxRetries:10,retryDelay:50}));
 let active,scenario,requests=[],rawRequests=[],captured=[],consolidations=0,dialogueStep=0,clock;
 const fake=createServer(async(req,res)=>{
  const chunks=[];for await(const chunk of req)chunks.push(chunk);const raw=Buffer.concat(chunks).toString('utf8');rawRequests.push(raw);const body=JSON.parse(raw);requests.push(body);
  if(active.label==='new')captured.push(capturePresentation(active.data,body));
  if(!body.tools){consolidations++;
   if(scenario==='consolidation-kill'&&consolidations===1){res.writeHead(200,{'Content-Type':'text/event-stream'});res.flushHeaders();return;}
   if(scenario==='retry'&&consolidations===1){res.writeHead(500);res.end();return;}
   res.end(text('整理原文')+done({prompt_tokens:2,completion_tokens:1}));return;
  }
  if(scenario==='zero-500'||scenario==='two-500'&&dialogueStep===2||scenario==='one-500'&&dialogueStep===1){res.writeHead(500);res.end();return;}
  if(scenario==='two-500'||scenario==='one-500'){dialogueStep++;res.end(text('先查')+tool('check',{query:'散步'})+done({prompt_tokens:1}));return;}
  if(scenario.startsWith('kill-')&&dialogueStep++===0){res.writeHead(200,{'Content-Type':'text/event-stream'});res.flushHeaders();if(scenario==='kill-partial')res.write(text('已推出'));return;}
  if(scenario==='disconnect'){res.write(text('开始'));await delay(100);res.end(text('结束')+done({prompt_tokens:2}));return;}
  res.end(text('正常原文')+done({prompt_tokens:2,completion_tokens:1}));
 });
 const base=await listen(fake);t.after(async()=>{const closed=new Promise(r=>fake.close(r));fake.closeAllConnections();await closed;});
 const unavailable=createServer(),deadBase=await listen(unavailable);await new Promise(r=>unavailable.close(r));
 for(scenario of ['zero-500','one-500','two-500','unavailable','kill-not-sent','kill-partial','consolidation-kill','retry','disconnect']){
  let expected;
  for(const [label,checkout] of [['old',legacy],['new',resolve('.')]]){
   const data=join(root,scenario,label);await mkdir(data,{recursive:true});active={data,label};requests=[];rawRequests=[];captured=[];consolidations=0;dialogueStep=0;
   // Only backoff is advanced, after an observed failed request; actual queue/timer
   // and service processes still run. Original P4 tests cover real 30s elapsed time.
   clock=join(root,'clock-'+label+'.txt');await writeFile(clock,'1792584000000');
   const hook=join(root,'clock-'+label+'.mjs');await writeFile(hook,`import{readFileSync}from'node:fs';Date.now=()=>Number(readFileSync(${JSON.stringify(clock)},'utf8'));`);
   const idle=['consolidation-kill','retry'].includes(scenario)?50:2147483647;
   let service=await startService(root,{checkout,data,snapshots:data+'-snapshots',baseUrl:scenario==='unavailable'?deadBase:base,hook,idle}),frames=[];
   try{
    if(scenario.startsWith('kill-')){
     const response=await fetch(service.url+'/api/messages',{method:'POST',body:JSON.stringify({text:'散步挂起'})});const reader=response.body.getReader();let bytes='';
     if(scenario==='kill-partial')while(!bytes.includes('event: delta')){const c=await reader.read();bytes+=Buffer.from(c.value).toString();}
     await until(()=>requests.length===1);await service.stop('SIGKILL');await reader.cancel().catch(()=>{});
     service=await startService(root,{checkout,data,snapshots:data+'-snapshots',baseUrl:base,hook});frames=[await service.post('恢复后继续')];
    }else if(scenario==='disconnect'){
     const response=await fetch(service.url+'/api/messages',{method:'POST',body:JSON.stringify({text:'浏览器断开'})});const reader=response.body.getReader();await reader.read();await reader.cancel();
     await until(()=>readEvents(data).some(e=>e.kind==='said'));
    }else{
     frames=[await service.post('散步材料')];
     if(idle===50)await writeFile(clock,'1792584000100');
     if(scenario==='consolidation-kill'){
      await until(()=>consolidations===1);await service.stop('SIGKILL');
      service=await startService(root,{checkout,data,snapshots:data+'-snapshots',baseUrl:base,hook,idle});await until(()=>readEvents(data).some(e=>e.kind==='wrote'));
     }
     if(scenario==='retry'){
      await until(()=>service.output.includes('Consolidation failed'));
      await writeFile(clock,'1792584031000');await until(()=>readEvents(data).some(e=>e.kind==='wrote'));
      assert.equal(consolidations,2);
     }
    }
    const usage=await(await fetch(service.url+'/api/usage')).json(),events=readEvents(data);
    if(label==='old')expected={events:withoutRecordedTime(events),requests:structuredClone(requests),rawRequests:[...rawRequests],frames:frames.map(g=>g.map(({event,data})=>({event,data}))),usage,raw:events};
    else{
     const mapping=normaliseP7Events(expected.raw,events);
     assert.deepEqual({events:mapping.events,requests,rawRequests,frames:mapping.frames(frames),usage},
      {events:expected.events,requests:expected.requests,rawRequests:expected.rawRequests,frames:expected.frames,usage:expected.usage},scenario);
     assertPresentations(data,captured,'测试人设原文\n',{allowUnsent:scenario==='unavailable',cliFile:join(root,'persona.txt')});
     const ps=events.filter(e=>e.kind==='presented'),db=new DatabaseSync(join(data,'archive.sqlite'),{readOnly:true});
     try{
      if(scenario.startsWith('kill-'))assert.deepEqual(presentedShow(db,ps[0].seq,'测试人设原文\n').outcome,
       {status:'failed',reason:'interrupted',outcome:scenario==='kill-partial'?'unknown':'not_sent'});
      if(['consolidation-kill','retry'].includes(scenario)){
       const cs=ps.filter(p=>p.meta.purpose==='consolidation');assert.equal(cs.length,2);
       assert.equal(presentedShow(db,cs[0].seq,'测试人设原文\n').outcome.status,'incomplete');
       assert.equal(presentedShow(db,cs[1].seq,'测试人设原文\n').outcome.status,'completed');
      }
     }finally{db.close();}
     // Commands while live must leave all data bytes and mtimes unchanged.
     const files=async()=>Promise.all((await readdir(data)).sort().map(async name=>({name,mtime:(await stat(join(data,name))).mtimeMs,bytes:(await stat(join(data,name))).isFile()?digest((await readFile(join(data,name))).toString('base64')):null})));
     const before=await files();cliPresented(data,null,['summary']);cliPresented(data,null,['writings']);cliPresented(data,join(root,'persona.txt'),['show',String(ps[0].seq)]);
     assert.deepEqual(await files(),before);
     await writeFile(join(root,'changed.txt'),'不同人设');assert.equal(cliPresented(data,join(root,'changed.txt'),['show',String(ps[0].seq)]).reconstruction.status,'persona_mismatch');
    }
   }finally{await service.stop();}
  }
 }
});

test('G4/G5: presentation durable before unsent SIGKILL; write/assembly failures are fatal',async t=>{
 const root=await mkdtemp(join(tmpdir(),'yuvi-p7-boundary-'));t.after(()=>rm(root,{recursive:true,force:true,maxRetries:10,retryDelay:50}));
 let count=0;const fake=createServer((req,res)=>{count++;res.end(text('不应发生')+done());});const base=await listen(fake);t.after(async()=>{const p=new Promise(r=>fake.close(r));fake.closeAllConnections();await p;});
 for(const fault of ['stop-after-write','write-failure','assembly-failure']){
  const data=join(root,fault),hook=join(root,fault+'.mjs');
  if(fault==='assembly-failure')await writeFile(hook,`import{Archive}from${JSON.stringify('file://'+resolve('dist/archive.js'))};Archive.prototype.writings=()=>{throw Error('private sentinel must not leak');};`);
  else await writeFile(hook,`import{DatabaseSync}from'node:sqlite';const original=DatabaseSync.prototype.prepare;DatabaseSync.prototype.prepare=function(sql){const st=original.call(this,sql);if(sql.includes('INSERT INTO events')){const run=st.run;st.run=function(...args){if(args[3]==='presented'&&${JSON.stringify(fault)}==='write-failure')throw Error('private sentinel must not leak');const result=run.apply(this,args);if(args[3]==='presented'&&${JSON.stringify(fault)}==='stop-after-write')process.kill(process.pid,'SIGSTOP');return result;};}return st;};`);
  let service=await startService(root,{data,baseUrl:base,hook});
  try{
   const response=await fetch(service.url+'/api/messages',{method:'POST',body:JSON.stringify({text:'尚未发送'})});const consumed=response.text().catch(()=>null);
   if(fault==='stop-after-write'){
    await until(()=>readEvents(data).some(e=>e.kind==='presented'));await service.stop('SIGKILL');await consumed;
    const before=readEvents(data);assert.equal(before.filter(e=>e.kind==='presented').length,1);assert.equal(count,0);
    service=await startService(root,{data,baseUrl:base});
    const events=assertPresentations(data,[],'测试人设原文\n',{allowUnsent:true});assert.equal(events.at(-1).meta.outcome,'not_sent');
    const snap=createSnapshot({dataDir:data,snapshotDir:join(root,'snapshots')}),restored=join(root,'restored');restoreSnapshot(snap,restored);
    assert.equal(cliPresented(restored,join(root,'persona.txt'),['show',String(before[1].seq)]).reconstruction.status,'exact');
   }else{
    await consumed;await until(()=>service.child.exitCode!==null);assert.equal(service.child.exitCode,1);
    assert.deepEqual(readEvents(data).map(e=>e.kind),['heard']);assert.equal(count,0);
    assert.ok(!service.output.includes('private sentinel'));
   }
  }finally{await service.stop();}
 }
});

test('G4 reconstruction refusal: missing persona, unknown rules, Node mismatch, bad digest and timezone',async t=>{
 const root=await mkdtemp(join(tmpdir(),'yuvi-p7-refusal-'));t.after(()=>rm(root,{recursive:true,force:true,maxRetries:10,retryDelay:50}));
 const fake=createServer(async(req,res)=>{for await(const _ of req){}res.end(text('原文')+done());});const base=await listen(fake);t.after(async()=>{const p=new Promise(r=>fake.close(r));fake.closeAllConnections();await p;});
 const data=join(root,'data'),service=await startService(root,{data,baseUrl:base});await service.post('原句');await service.stop();
 const p=readEvents(data).find(e=>e.kind==='presented'),a=new Archive(data);
 try{
  for(const [patch,status] of [[{rules:'future'},'rules_unsupported'],[{node_major:999},'node_mismatch'],[{messages_sha256:'0'.repeat(64)},'mismatch'],[{time_zone:'invalid/zone'},'mismatch']]){
   const e=a.append({class:'control',kind:'presented',actor:'system',reply_to:p.reply_to,model:p.model,meta:{...p.meta,...patch}});
   const result=cliPresented(data,join(root,'persona.txt'),['show',String(e.seq),'--messages']);assert.equal(result.reconstruction.status,status);
  }
  assert.equal(cliPresented(data,null,['show',String(p.seq),'--messages']).reconstruction.status,'persona_mismatch');
 }finally{a.close();}
});

test('G4 reported legacy boundary: unpaired UTF-16 is lost by P6 SQLite binding; never claim exact replay',async t=>{
 const root=await mkdtemp(join(tmpdir(),'yuvi-p7-legacy-unicode-')),legacy=await legacyCheckout(root,'9f67b81');t.after(()=>rm(root,{recursive:true,force:true,maxRetries:10,retryDelay:50}));
 const hook=join(root,'clock.mjs');await writeFile(hook,'Date.now=()=>1792584000000;');
 const bodies=[];const fake=createServer(async(req,res)=>{let raw='';for await(const c of req)raw+=c;bodies.push(JSON.parse(raw));res.end(text('回复')+done());});const base=await listen(fake);t.after(async()=>{const p=new Promise(r=>fake.close(r));fake.closeAllConnections();await p;});
 for(const [label,checkout]of[['baseline',legacy],['p7',resolve('.')]]){
  const data=join(root,label),s=await startService(root,{checkout,data,baseUrl:base,hook});
  try{await s.post('原文\ud800尾部');const db=new DatabaseSync(join(data,'archive.sqlite'),{readOnly:true});
   try{assert.equal(db.prepare("SELECT hex(CAST(content AS BLOB)) bytes FROM events WHERE kind='heard'").get().bytes,'E58E9FE69687EFBFBDE5B0BEE983A8');
    if(label==='p7'){const seq=Number(db.prepare("SELECT seq FROM events WHERE kind='presented'").get().seq);assert.equal(presentedShow(db,seq,'测试人设原文\n').reconstruction.status,'mismatch');}
   }finally{db.close();}
  }finally{await s.stop();}
 }
 assert.deepEqual(bodies[0],bodies[1]);assert.ok(bodies[0].messages.at(-1).content.includes('\ud800'));
});

test('G6 reported SQLite boundary: closed WAL readonly diagnostics preserve archive bytes but may create coordination sidecars',async t=>{
 const root=await mkdtemp(join(tmpdir(),'yuvi-p7-sidecar-'));t.after(()=>rm(root,{recursive:true,force:true,maxRetries:10,retryDelay:50}));
 const a=new Archive(root),h=a.append({class:'experience',kind:'heard',actor:'owner',content:'独立数据'});a.append({class:'act',kind:'silent',actor:'yuvi',reply_to:h.id});a.close();
 const source=await readFile(join(root,'archive.sqlite')),lock=await readFile(join(root,'service.lock'));
 assert.equal(cliPresented(root,null,['summary']).count,0);assert.equal(cliPresented(root,null,['writings']).never_presented,0);
 assert.deepEqual(await readFile(join(root,'archive.sqlite')),source);assert.deepEqual(await readFile(join(root,'service.lock')),lock);
 assert.ok((await readdir(root)).every(name=>['archive.sqlite','archive.sqlite-wal','archive.sqlite-shm','service.lock'].includes(name)));
});
