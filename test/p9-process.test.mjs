import {test} from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';import {join,resolve} from 'node:path';import {tmpdir} from 'node:os';import {once} from 'node:events';import {createServer} from 'node:http';
import {Archive} from '../dist/archive.js';import {listen,startService,text,tool,done,legacyCheckout} from './helpers/p6-process.mjs';import {readEvents,capturePresentation,assertPresentations} from './helpers/p7-records.mjs';
test('P9 K4: SIGKILL exactly after recalled commit, restart restores once and keeps exact request history',async t=>{
 const root=mkdtempSync(join(tmpdir(),'yuvi-p9-kill-'));t.after(()=>rmSync(root,{recursive:true,force:true}));const data=join(root,'data'),a=new Archive(data);a.append({class:'inner',kind:'wrote',actor:'yuvi',content:'旧照片放在抽屉'});a.close();
 const captured=[];let kill=true;const fake=createServer(async(req,res)=>{const chunks=[];for await(const c of req)chunks.push(c);const body=JSON.parse(Buffer.concat(chunks).toString());captured.push(capturePresentation(data,body));res.end(kill?tool('recall',{query:'旧照片'})+done({prompt_tokens:7}):text('恢复后正常')+done({prompt_tokens:5}));});const base=await listen(fake);t.after(()=>new Promise(r=>fake.close(r)));
 const hook=join(root,'kill.mjs');writeFileSync(hook,`import{Archive}from${JSON.stringify(resolve('dist/archive.js'))};const original=Archive.prototype.append;Archive.prototype.append=function(input){const e=original.call(this,input);if(input.kind==='recalled')process.kill(process.pid,'SIGKILL');return e;};`);
 let s=await startService(root,{data,baseUrl:base,recall:true,hook});t.after(()=>s.stop());const exited=once(s.child,'exit');const request=s.post('请回想旧照片').catch(()=>null);await exited;await request;
 const before=readEvents(data);assert.equal(before.filter(e=>e.kind==='recalled').length,1);assert.equal(before.filter(e=>e.kind==='error').length,0);kill=false;
 s=await startService(root,{data,baseUrl:base,recall:true});const recovery=readEvents(data).filter(e=>e.kind==='error');assert.equal(recovery.length,1);assert.equal(recovery[0].meta.reason,'interrupted');assert.equal(recovery[0].meta.outcome,'not_sent');await s.post('接着聊');await s.stop();
 const events=assertPresentations(data,captured,'测试人设原文\n');assert.equal(events.filter(e=>e.kind==='recalled').length,1);assert.deepEqual(events.slice(0,before.length),before);
});

test('P9 S12/C2: actual P8 process versus disabled P9 requests, events, SSE and usage equivalent',async t=>{
 const root=mkdtempSync(join(tmpdir(),'yuvi-p9-p8-'));t.after(()=>rmSync(root,{recursive:true,force:true}));const old=await legacyCheckout(root,'8a9c1fe');
 let data,captured=[],requests=[],active;const fake=createServer(async(req,res)=>{const chunks=[];for await(const c of req)chunks.push(c);const body=JSON.parse(Buffer.concat(chunks).toString());requests.push(body);if(active==='new')captured.push(capturePresentation(data,body));res.end(body.messages.some(m=>m.role==='tool')?text('相同原文')+done({prompt_tokens:3}):tool('check',{query:'相同'})+done({prompt_tokens:2}));});const base=await listen(fake);t.after(()=>new Promise(r=>fake.close(r)));
 const hook=join(root,'clock.mjs');writeFileSync(hook,'Date.now=()=>1792584000000;');let expected;
 for(const[label,checkout]of [['old',old],['new',resolve('.')]]){active=label;data=join(root,label);requests=[];const s=await startService(root,{checkout,data,baseUrl:base,recall:false,surfacing:'off',hook});try{
  const frames=[await s.post('相同经历'),await s.post('查相同经历')],events=readEvents(data),usage=await(await fetch(s.url+'/api/usage')).json();
  if(label==='old')expected={events,requests:structuredClone(requests),frames:frames.map(g=>g.map(({event,data})=>({event,data}))),usage};else{
   assert.equal(events.length,expected.events.length);const ids=new Map(events.map((e,i)=>[e.id,expected.events[i].id]));const norm=v=>typeof v==='string'?(ids.get(v)??v):Array.isArray(v)?v.map(norm):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,x])=>[k,norm(x)])):v;assert.deepEqual(requests,expected.requests);assert.deepEqual(norm(events),expected.events);assert.deepEqual(norm(frames.map(g=>g.map(({event,data})=>({event,data})))),expected.frames);assert.deepEqual(usage,expected.usage);assertPresentations(data,captured,'测试人设原文\n');
  }
 }finally{await s.stop();}}
});
