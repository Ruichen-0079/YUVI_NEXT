import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, mkdir, cp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { Archive } from '../dist/archive.js';
import { createSnapshot, verifySnapshot } from '../dist/snapshots.js';
import { generate } from '../scripts/p6/generate.mjs';
import { insertEvents } from './helpers/archive-fixture.mjs';
import { legacyCheckout, listen, startService, normaliseRun, text, tool, done } from './helpers/p6-process.mjs';
import { normaliseP7Events, withoutRecordedTime } from './helpers/p7-equivalence.mjs';
import { capturePresentation, assertPresentations, cliPresented } from './helpers/p7-records.mjs';
import * as reference from './helpers/p4-context.mjs';
function rows(data){const db=new DatabaseSync(join(data,'archive.sqlite'),{readOnly:true});try{return db.prepare('SELECT * FROM events ORDER BY seq').all().map(e=>({...e,meta:JSON.parse(e.meta)}));}finally{db.close();}}

test('G2/G3/G4/G6: real P6/P7 services, reference mapping, request manifests and historical reconstruction', async t=>{
  const root=await mkdtemp(join(tmpdir(),'yuvi-p7-process-'));const legacy=await legacyCheckout(root,'9f67b81');
  t.after(()=>rm(root,{recursive:true,force:true,maxRetries:10,retryDelay:50}));
  const clockFile=join(root,'clock.txt');await writeFile(clockFile,'1792584000000');
  const hook=join(root,'clock.mjs');await writeFile(hook,`import{readFileSync}from'node:fs';Date.now=()=>Number(readFileSync(${JSON.stringify(clockFile)},'utf8'));`);
  let sequence=0,requests=[],rawRequests=[],failure=false,searchQuery='散步',activeData,activeLabel,captured=[],special='';
  const model=createServer(async(req,res)=>{
    const chunks=[];for await(const chunk of req)chunks.push(chunk);const raw=Buffer.concat(chunks).toString('utf8');rawRequests.push(raw);const body=JSON.parse(raw);requests.push(body);if(activeLabel==='new')captured.push(capturePresentation(activeData,body));
    const usage={prompt_tokens:++sequence,completion_tokens:sequence+1,prompt_cache_hit_tokens:sequence*2};
    if(special==='clock-shift')await writeFile(clockFile,String(1792584000000+sequence*10000));
    if(!body.tools){if(failure){res.writeHead(500);res.end('failure');}else res.end(text('模型写下整段原文 😀')+done(usage));return;}
    if(body.messages.some(m=>m.content.endsWith('静默检查'))){res.end(tool('stay_silent',{reason:'原理由'})+done(usage));return;}
    if(special==='four-check'||special==='mixed'){res.end((special==='four-check'&&body.messages.filter(m=>m.role==='tool').length===3?text('四步完成'): '')+tool('check',{query:searchQuery})+(special==='mixed'?`data: ${JSON.stringify({choices:[{delta:{tool_calls:[{index:1,function:{name:'stay_silent',arguments:'{}'}}]}}]})}\n\n`:'')+done(usage));return;}
    if(body.messages.some(m=>m.role==='tool'))res.end(text('原文接续')+done(usage));
    else res.end(text(special==='embedded-nul'?'我核对\0原始尾部':'我核对')+tool('check',{query:searchQuery})+done(usage));
  });
  const base=await listen(model);t.after(async()=>{const closed=new Promise(r=>model.close(r));model.closeAllConnections();await closed;});
  for(const scenario of ['near-jump','just-jumped','lagging','backlog','empty','oversized-length','interrupted','foreign','failure','four-check','mixed','embedded-nul','clock-shift']){
    special=['four-check','mixed','embedded-nul','clock-shift'].includes(scenario)?scenario:'';searchQuery=scenario==='foreign'?'foreign-only-secret':'散步';
    const seed=join(root,scenario,'seed');await mkdir(seed,{recursive:true});generate(join(seed,'archive.sqlite'),{count:3000,seed:9,shape:scenario==='empty'?'empty':'typical'});
    const a=new Archive(seed);
    const pair=()=>{const h=a.append({class:'experience',kind:'heard',actor:'owner',content:'补充 散步'});const attempt=a.append({class:'act',kind:'reply_attempt',actor:'yuvi',reply_to:h.id});a.append({class:'act',kind:'said',actor:'yuvi',reply_to:h.id,content:'回应',meta:{attempt:attempt.id}});};
    const cover=()=>{for(;;){const material=a.materials(10);if(!material.length)break;a.append({class:'inner',kind:'wrote',actor:'yuvi',model:'fixture',content:scenario==='empty'?'':'既有文字',meta:{material:{from_seq:material[0].seq,through_seq:material.at(-1).seq},finish_reason:'stop'}});}};
    if(['lagging','backlog','failure'].includes(scenario))for(let i=0;i<(scenario==='lagging'?7:11);i++)pair();
    if(['near-jump','just-jumped'].includes(scenario)){
      const target=scenario==='near-jump'?0:2;
      while(a.progress().dialogueCount%10!==target){const h=a.append({class:'experience',kind:'heard',actor:'owner',content:'单条'});a.append({class:'control',kind:'error',actor:'system',reply_to:h.id,meta:{reason:'model_failure',outcome:'not_sent',request_chars:0}});}cover();
    }
    if(scenario==='oversized-length'){pair();const m=a.materials(10);a.append({class:'inner',kind:'wrote',actor:'yuvi',model:'fixture',content:'😀'.repeat(8001),meta:{material:{from_seq:m[0].seq,through_seq:m.at(-1).seq},finish_reason:'length'}});}
    if(scenario==='interrupted'){const h=a.append({class:'experience',kind:'heard',actor:'owner',content:'中断 散步'});a.append({class:'act',kind:'reply_attempt',actor:'yuvi',reply_to:h.id});a.append({class:'experience',kind:'heard',actor:'owner',content:'尚未发送'});}
    if(scenario==='foreign'){
      let seq=a.events().at(-1).seq+1;const extra=[];
      for(const scope of [{scene:'other',branch:'dev:v2-dev'},{scene:'web',branch:'fork:x'}]){
        const id='foreign-'+seq;extra.push({seq:seq++,id,class:'experience',kind:'heard',actor:'owner',content:'foreign-only-secret',...scope});
        extra.push({seq:seq++,id:'end-'+seq,class:'act',kind:'silent',actor:'yuvi',reply_to:id,content:'foreign-only-secret',...scope});
        extra.push({seq:seq++,id:'writing-'+seq,class:'inner',kind:'wrote',actor:'yuvi',content:'foreign-only-secret',meta:{material:{from_seq:1,through_seq:999999}},...scope});
      }insertEvents(a.db,extra);
    }
    a.close();const existing=rows(seed).length;
    let expected, oldEvents;
    for(const [label,checkout] of [['old',legacy],['new',resolve('.')]]){
      await writeFile(clockFile,'1792584000000');const data=join(root,scenario,label);await cp(seed,data,{recursive:true});requests=[];rawRequests=[];sequence=0;failure=scenario==='failure';activeData=data;activeLabel=label;captured=[];
      const service=await startService(root,{checkout,data,baseUrl:base,context:10,writing:100,hook});
      let frames,usage;
      try{frames=[await service.post(special==='embedded-nul'?'同一句话 散步\0原始尾部':'同一句话 散步'),await service.post('静默检查')];usage=await (await fetch(service.url+'/api/usage')).json();
        if(label==='new'){assertPresentations(data,captured,'测试人设原文\n',{cliFile:join(root,'persona.txt')});}
      }finally{await service.stop();}
      const events=rows(data);
      if(label==='old'){oldEvents=events;expected={events:withoutRecordedTime(events),frames:frames.map(g=>g.map(({event,data})=>({event,data}))),requests,rawRequests,usage};}
      else {const mapped=normaliseP7Events(oldEvents,events);assert.deepEqual({events:mapped.events,frames:mapped.frames(frames),requests,rawRequests,usage},expected,scenario);}
      assert.ok(requests.some(r=>r.messages.some(m=>m.role==='tool')));
      if(['lagging','backlog','failure'].includes(scenario))assert.ok(requests.some(r=>!r.tools));
      if(scenario==='foreign'){
        assert.ok(!requests.some(r=>r.messages.some(m=>m.content.includes('foreign-only-secret'))));
        assert.equal(events.findLast(e=>e.kind==='checked').meta.total,0);
      }
      if(scenario==='interrupted')assert.equal(events.slice(existing).filter(e=>e.meta.reason==='interrupted').length,2);
    }
  }
  // F2: create the historical events and snapshots using actual main@190a272 code.
  const seed=join(root,'historical'),restored=join(root,'historical-restored');
  const program=`import {Archive} from ${JSON.stringify('file://'+join(legacy,'dist/archive.js'))};
    import {createSnapshot,restoreSnapshot} from ${JSON.stringify('file://'+join(legacy,'dist/snapshots.js'))};
    const a=new Archive(process.argv[1]);let first,last;
    for(const kind of ['said','silent','error']){const h=a.append({class:'experience',kind:'heard',actor:'owner',content:'旧原话 散步'});first??=h;
      if(kind==='said'){const c=a.append({class:'act',kind:'checked',actor:'yuvi',reply_to:h.id,model:'old',meta:{arguments:{query:'absent'},result_seqs:[],total:0}});const attempt=a.append({class:'act',kind:'reply_attempt',actor:'yuvi',reply_to:h.id});last=a.append({class:'act',kind,actor:'yuvi',reply_to:h.id,content:'旧回复',meta:{attempt:attempt.id}});}
      else last=a.append({class:kind==='error'?'control':'act',kind,actor:kind==='error'?'system':'yuvi',reply_to:h.id,meta:kind==='error'?{outcome:'not_sent',reason:'model_failure',request_chars:0}:{}});}
    a.append({class:'inner',kind:'wrote',actor:'yuvi',content:'旧文字',model:'old',meta:{material:{from_seq:first.seq,through_seq:last.seq}}});
    const h=a.append({class:'experience',kind:'heard',actor:'owner',content:'旧积压'});last=a.append({class:'act',kind:'silent',actor:'yuvi',reply_to:h.id});
    a.append({class:'control',kind:'unconsolidated',actor:'system',meta:{material:{from_seq:h.seq,through_seq:last.seq},reason:'backlog'}});
    const file=createSnapshot({dataDir:process.argv[1],snapshotDir:process.argv[1]+'-snapshots'});a.close();restoreSnapshot(file,process.argv[2]);
    console.log(createSnapshot({dataDir:process.argv[2],snapshotDir:process.argv[2]+'-snapshots'}));`;
  const snapshot=execFileSync(process.execPath,['--input-type=module','-e',program,seed,restored],{encoding:'utf8'}).trim();
  const before=rows(restored),db=new DatabaseSync(join(restored,'archive.sqlite'),{readOnly:true});const schema=db.prepare('SELECT * FROM sqlite_master ORDER BY name').all();db.close();
  sequence=0;failure=false;special='';activeLabel='new';activeData=restored;captured=[];const service=await startService(root,{data:restored,baseUrl:base,hook,context:2});await service.post('新回合');await service.post('触发压力整理');await service.stop();
  assert.ok(captured.some(c=>!c.body.tools),'G2 must include actual consolidation on the legacy archive');
  assert.deepEqual(rows(restored).slice(0,before.length),before);
  const after=new DatabaseSync(join(restored,'archive.sqlite'),{readOnly:true});assert.deepEqual(after.prepare('SELECT * FROM sqlite_master ORDER BY name').all(),schema);after.close();
  assert.equal(rows(restored).at(-1).kind,'said');verifySnapshot(snapshot);
  verifySnapshot(createSnapshot({dataDir:restored,snapshotDir:join(root,'new-snapshots')}));
  assertPresentations(restored,captured,'测试人设原文\n',{cliFile:join(root,'persona.txt')});
  const beforeSummary=cliPresented(seed,null,['summary']);assert.equal(beforeSummary.count,0);assert.ok(cliPresented(seed,null,['writings']).never_presented>0);
});
