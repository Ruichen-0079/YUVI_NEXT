import {test} from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';import {join} from 'node:path';import {tmpdir} from 'node:os';import {spawn,spawnSync} from 'node:child_process';import {once} from 'node:events';import {createServer} from 'node:http';
import {loadLife,expand} from '../eval/life.mjs';import {measure} from '../eval/measure.mjs';import {realPlan,UsageBudget} from '../eval/real-guard.mjs';import {listen,text,done} from './helpers/p6-process.mjs';
test('P9 E1: life-r preserves all frozen facts, probes, gaps and times, with answer keys and smaller rhythm',()=>{
 const a=loadLife('life-a'),r=loadLife('life-r');assert.equal(r.config.YUVI_CONTEXT_EVENTS,40);assert.equal(r.rhythm.messages,10);
 for(const field of ['start','days','time_zone','owner_name','probes','sanity','gaps','filler'])assert.deepEqual(r[field],a[field]);
 for(const field of ['facts','people']){const withoutKeys=r[field].map(e=>Object.fromEntries(Object.entries(e).map(([k,v])=>[k,Array.isArray(v)?v.map(({answer_key,...v})=>v):v])));assert.deepEqual(withoutKeys,a[field]);for(const e of r[field])for(const v of e.versions??e.mentions)assert.ok(v.answer_key);}
 assert.deepEqual(expand(r).events.filter(e=>e.type!=='ordinary'),expand(a).events.filter(e=>e.type!=='ordinary'));
});
test('P9 E2/E5: four new arms deterministic fast regression and window sanity',()=>{
 const root=mkdtempSync(join(tmpdir(),'yuvi-p9-eval-')),start=performance.now();try{
 for(const arm of ['E-R','E-S','E-SR','E-SC']){let before;for(let i=0;i<2;i++){
  const out=join(root,arm+i),p=spawnSync(process.execPath,['eval/run.mjs','life-a',arm,out,'7','excerpt'],{env:{...process.env,TZ:'Asia/Shanghai'},encoding:'utf8',timeout:90000});assert.equal(p.status,0,p.stderr);const m=measure(out);assert.equal(m.reasons.unexplained,0);assert.ok(m.sanity.length);assert.ok(m.sanity.every(p=>p.answers.every(a=>a.window)));assert.deepEqual(m.surfacing.duplicates,{foreground:0,window:0});
  const bytes=readFileSync(join(out,'metrics.json'),'utf8');if(before)assert.equal(bytes,before);else before=bytes;
 }}assert.ok(performance.now()-start<=120000,'P9 new fast regressions exceed 120s');
 }finally{rmSync(root,{recursive:true,force:true});}
});
test('P9 real guard: refuses before credentials/network, explicit caps; provider usage stops fail-closed',()=>{
 assert.throws(()=>realPlan([],{YUVI_MODEL_API_KEY:'unread-test-placeholder'}),/approval/);
 const env={YUVI_REAL_MODEL_APPROVAL:'https://github.com/Ruichen-0079/YUVI_NEXT/pull/23#issuecomment-1'};
 assert.throws(()=>realPlan(['--arm','R1','--out','new'],env),/limits/);
 const plan=realPlan(['--arm','R1','--out','new','--max-input-tokens','10','--max-output-tokens','5'],env),budget=new UsageBudget(plan);
 budget.add({prompt_tokens:9,completion_tokens:1});assert.equal(budget.stopped,false);budget.add({prompt_tokens:1,completion_tokens:1});assert.equal(budget.stopped,true);assert.equal(budget.reason,'token_limit');
 const missing=new UsageBudget(plan);missing.add(undefined);assert.equal(missing.reason,'usage_unavailable');
 const child=spawnSync(process.execPath,['eval/cli.mjs','real','--arm','R1','--out','unused'],{env:{...process.env,YUVI_REAL_MODEL_APPROVAL:''},encoding:'utf8'});assert.equal(child.status,1);assert.match(child.stderr,/approval/);
});
test('P9 real driver: loopback fake provider cap halts subsequent requests and marks partial evidence',async t=>{
 const root=mkdtempSync(join(tmpdir(),'yuvi-p9-real-fake-'));t.after(()=>rmSync(root,{recursive:true,force:true}));let calls=0;
 const fake=createServer(async(req,res)=>{for await(const c of req){}calls++;res.end(text('纯离线假模型')+done({prompt_tokens:100,completion_tokens:4}));});const base=await listen(fake);t.after(()=>new Promise(r=>fake.close(r)));
 const child=spawn(process.execPath,['eval/cli.mjs','real','--arm','R1','--out',join(root,'run'),'--max-input-tokens','100','--max-output-tokens','10'],{env:{...process.env,YUVI_REAL_MODEL_APPROVAL:'https://github.com/Ruichen-0079/YUVI_NEXT/pull/23#issuecomment-1',YUVI_MODEL_BASE_URL:base+'/v1',YUVI_MODEL:'offline-budget-fake',YUVI_MODEL_API_KEY:'fake-only-not-a-credential'},stdio:['ignore','pipe','pipe']});let output='';child.stdout.on('data',d=>output+=d);child.stderr.on('data',d=>output+=d);
 const [code]=await once(child,'exit');assert.equal(code,0,output);assert.equal(calls,1);const b=JSON.parse(readFileSync(join(root,'run/budget.json'),'utf8'));assert.equal(b.incomplete,true);assert.equal(b.reason,'token_limit');assert.match(output,/input_token_limit/);assert.ok(!output.includes('fake-only-not-a-credential'));
});

test('P9-R offline only: complete 63-day real-driver path against loopback fake, usage and proxies retained',async t=>{
 const root=mkdtempSync(join(tmpdir(),'yuvi-p9-real-full-fake-'));t.after(()=>rmSync(root,{recursive:true,force:true}));let calls=0;
 const fake=createServer(async(req,res)=>{for await(const c of req){}calls++;res.end(text('离线完整驱动')+done({prompt_tokens:4,completion_tokens:1}));});const base=await listen(fake);t.after(()=>new Promise(r=>fake.close(r)));
 const child=spawn(process.execPath,['eval/cli.mjs','real','--arm','R2','--out',join(root,'run'),'--max-input-tokens','1000000','--max-output-tokens','100000'],{env:{...process.env,YUVI_REAL_MODEL_APPROVAL:'https://github.com/Ruichen-0079/YUVI_NEXT/pull/23#issuecomment-1',YUVI_MODEL_BASE_URL:base+'/v1',YUVI_MODEL:'offline-complete-fake',YUVI_MODEL_API_KEY:'fake-only'},stdio:['ignore','pipe','pipe']});let output='';child.stdout.on('data',d=>output+=d);child.stderr.on('data',d=>output+=d);
 const [code]=await once(child,'exit');assert.equal(code,0,output);assert.ok(calls>500);const budget=JSON.parse(readFileSync(join(root,'run/budget.json'),'utf8'));assert.equal(budget.incomplete,false);assert.equal(budget.input_tokens,calls*4);assert.equal(budget.output_tokens,calls);const m=JSON.parse(readFileSync(join(root,'run/real-metrics.json'),'utf8'));assert.equal(m.incomplete,false);assert.equal(m.observed_turns,m.planned_turns);assert.ok(m.probes.length>30);assert.match(m.evidence,/not proof/);
});
