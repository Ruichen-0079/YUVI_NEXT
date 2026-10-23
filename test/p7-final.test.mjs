import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, rm, writeFile, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { Archive } from '../dist/archive.js';
import { presentedShow } from '../dist/presented.js';
import { legacyCheckout, listen, startService, text, tool, done } from './helpers/p6-process.mjs';
import { readEvents, cliPresented, capturePresentation, digest } from './helpers/p7-records.mjs';
import { normaliseP7Events, withoutRecordedTime } from './helpers/p7-equivalence.mjs';

// Fresh processes are essential: Date/Intl timezone resolution depends on process TZ.
test('G3/G4: P6/P7 process differential for empty, POSIX, invalid, IANA and absent TZ', async t => {
 const root=await mkdtemp(join(tmpdir(),'yuvi-p7-tz-')),legacy=await legacyCheckout(root,'9f67b81');
 t.after(()=>rm(root,{recursive:true,force:true}));
 const hook=join(root,'clock.mjs');await writeFile(hook,'Date.now=()=>1792584000000;');
 let requests=[],captured=[],active;
 const fake=createServer(async(req,res)=>{
  const chunks=[];for await(const c of req)chunks.push(c);const raw=Buffer.concat(chunks).toString('utf8'),body=JSON.parse(raw);requests.push(raw);
  if(active.label==='new')captured.push(capturePresentation(active.data,body));
  if(!body.tools){res.end(text('留下早晨散步的经历')+done({prompt_tokens:4}));return;}
  res.end(body.messages.some(m=>m.role==='tool')?text('查到原文')+done({prompt_tokens:3}):tool('check',{query:'早晨'})+done({prompt_tokens:2}));
 });const base=await listen(fake);t.after(()=>new Promise(r=>fake.close(r)));
 for(const [i,tz] of ['', 'CST-8','Garbage/Zone','EST5EDT','GMT+8','GMT-3','Etc/GMT+8','UTC-3','Asia/Shanghai','America/New_York',null].entries()){
  let expected;
  for(const [label,checkout] of [['old',legacy],['new',resolve('.')]]){
   const data=join(root,i+'-'+label);active={data,label};requests=[];captured=[];
   const s=await startService(root,{checkout,data,baseUrl:base,hook,tz,context:2,snapshots:data+'-snapshots'});
   try{
    const frames=[await s.post('早晨去散步'),await s.post('再核对早晨的事')],events=readEvents(data),usage=await(await fetch(s.url+'/api/usage')).json();
    if(label==='old')expected={events:withoutRecordedTime(events),raw:events,requests:[...requests],frames:frames.map(g=>g.map(({event,data})=>({event,data}))),usage};
    else{
     const mapped=normaliseP7Events(expected.raw,events);
     assert.deepEqual({events:mapped.events,requests,frames:mapped.frames(frames),usage},{events:expected.events,requests:expected.requests,frames:expected.frames,usage:expected.usage},String(tz));
     assert.equal(captured.length,5);assert.ok(events.some(e=>e.kind==='wrote'));
     for(const p of events.filter(e=>e.kind==='presented')){
      assert.ok(Object.hasOwn(p.meta,'time_zone'));
      const invalid=['','CST-8','Garbage/Zone','GMT+8','GMT-3','UTC-3'].includes(tz);
      if(invalid)assert.equal(p.meta.time_zone,null);
      const show=cliPresented(data,join(root,'persona.txt'),['show',String(p.seq),'--messages']);
      assert.equal(show.reconstruction.status,invalid?'time_zone_unrecorded':'exact',String(tz));
      if(!invalid)assert.equal(digest(show.messages),p.meta.messages_sha256);
     }
    }
   }finally{await s.stop();}
  }
 }
});

test('G4: possible source loss requires digest mismatch plus current heard U+FFFD; genuine Unicode remains exact', async t => {
 const root=await mkdtemp(join(tmpdir(),'yuvi-p7-utf-')),legacy=await legacyCheckout(root,'9f67b81');t.after(()=>rm(root,{recursive:true,force:true}));
 const hook=join(root,'clock.mjs');await writeFile(hook,'Date.now=()=>1792584000000;');let requests=[];
 const fake=createServer(async(req,res)=>{const chunks=[];for await(const c of req)chunks.push(c);requests.push(Buffer.concat(chunks).toString('utf8'));res.end(text('继续')+done());});
 const base=await listen(fake);t.after(()=>new Promise(r=>fake.close(r)));
 for(const [i,input] of ['孤立\ud800尾','孤立\udfff尾','真实\ufffd尾','空\0尾','表情😀尾','普通原文'].entries()){
  let expected;
  for(const [label,checkout]of[['old',legacy],['new',resolve('.')]]){
   const data=join(root,i+'-'+label);requests=[];const s=await startService(root,{checkout,data,baseUrl:base,hook,snapshots:data+'-snapshots'});
   try{await s.post(input);}finally{await s.stop();}
   if(label==='old'){expected=[...requests];continue;}
   assert.deepEqual(requests,expected);
   const p=readEvents(data).find(e=>e.kind==='presented');
   const result=cliPresented(data,join(root,'persona.txt'),['show',String(p.seq),'--messages']);
   assert.equal(result.reconstruction.status,i<2?'source_lossy':'exact');
   if(i<2)assert.match(result.reconstruction.reason,/possible.*not proof.*not excluded/);
   else assert.deepEqual(result.messages,JSON.parse(requests[0]).messages);
   const a=new Archive(data);
   try{
    const append=patch=>a.append({class:'control',kind:'presented',actor:'system',reply_to:p.reply_to,model:p.model,meta:{...p.meta,...patch}});
    const changed=append({messages_sha256:'0'.repeat(64)}),db=new DatabaseSync(join(data,'archive.sqlite'),{readOnly:true});
    try{
     assert.equal(presentedShow(db,changed.seq,'测试人设原文\n').reconstruction.status,i<3?'source_lossy':'mismatch');
     // A count-only discrepancy is never source_lossy when the digest still agrees.
     const badCount=append({total:{...p.meta.total,chars:p.meta.total.chars+1}});
     if(i>=2)assert.equal(presentedShow(db,badCount.seq,'测试人设原文\n').reconstruction.status,'mismatch');
     for(const [patch,status]of [[{node_major:999},'node_mismatch'],[{rules:'future'},'rules_unsupported'],[{time_zone:null},'time_zone_unrecorded']]){
      const e=append(patch);assert.equal(presentedShow(db,e.seq,'测试人设原文\n').reconstruction.status,status);
     }
     assert.equal(presentedShow(db,p.seq,'另一个人设').reconstruction.status,'persona_mismatch');
    }finally{db.close();}
   }finally{a.close();}
  }
 }
});

test('G6: live and cold diagnostics preserve facts, idle WAL and service lock; active read and subsequent turn work', async t=>{
 const root=await mkdtemp(join(tmpdir(),'yuvi-p7-logical-readonly-'));t.after(()=>rm(root,{recursive:true,force:true}));
 let release,started;const pending=new Promise(r=>started=r);let calls=0;
 const fake=createServer(async(req,res)=>{for await(const _ of req){}if(++calls===2){started();await new Promise(r=>release=r);}res.end(text('一致读取后继续')+done());});
 const base=await listen(fake);t.after(()=>new Promise(r=>fake.close(r)));
 const data=join(root,'data');let s=await startService(root,{data,baseUrl:base,snapshots:data+'-snapshots'});t.after(()=>s.stop());
 await s.post('第一句');const p=readEvents(data).find(e=>e.kind==='presented');
 const files=async()=>{
  const result={events:readEvents(data),main:await readFile(join(data,'archive.sqlite')),lock:await readFile(join(data,'service.lock')),lockMtime:(await stat(join(data,'service.lock'))).mtimeMs};
  try{result.wal=await readFile(join(data,'archive.sqlite-wal'));}catch(e){if(e.code!=='ENOENT')throw e;}return result;
 };
 const commands=()=>{cliPresented(data,null,['summary']);cliPresented(data,null,['writings']);assert.equal(cliPresented(data,join(root,'persona.txt'),['show',String(p.seq)]).reconstruction.status,'exact');};
 for(const cold of [false,true]){
  if(cold)await s.stop();const before=await files();commands();const after=await files();
  assert.deepEqual(after.events,before.events);assert.deepEqual(after.main,before.main);assert.deepEqual(after.lock,before.lock);assert.equal(after.lockMtime,before.lockMtime);
  if(before.wal)assert.deepEqual(after.wal,before.wal);
 }
 s=await startService(root,{data,baseUrl:base,snapshots:data+'-snapshots'});
 const turn=s.post('正在生成时读取');await pending;const before=await files();commands();assert.deepEqual(await files(),before);release();await turn;
 await s.post('读取后正常继续');assert.equal(readEvents(data).filter(e=>e.kind==='said').length,3);
});
