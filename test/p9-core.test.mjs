import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createServer} from 'node:http';
import {Archive} from '../dist/archive.js';
import {ArchiveIndex,buildIndex} from '../dist/archive-index.js';
import {check} from '../dist/context.js';
import {listen,startService,text,tool,done,frame} from './helpers/p6-process.mjs';
import {capturePresentation,assertPresentations,readEvents} from './helpers/p7-records.mjs';

function fixture(t){const root=mkdtempSync(join(tmpdir(),'yuvi-p9-'));const a=new Archive(join(root,'data'));t.after(()=>{a.close();rmSync(root,{recursive:true,force:true});});return{root,a};}
const wrote=(a,content,material)=>a.append({class:'inner',kind:'wrote',actor:'yuvi',content,meta:material?{material}: {}});

test('P9 recall: own nonempty writings only, index and literal fallback, independent budgets and ranks',async t=>{
 const {root,a}=fixture(t);a.append({class:'experience',kind:'heard',actor:'owner',content:'旧照片只是原话 🌙'});
 const old=wrote(a,'旧照片放在抽屉 🌙');wrote(a,'');
 for(let i=0;i<15;i++)wrote(a,'旧照片已经扫描 '+i);
 const last=wrote(a,'最新旧照片 🌙');a.append({class:'inner',kind:'wrote',actor:'yuvi',scene:'qq',content:'秘密旧照片 🌙'});a.append({class:'inner',kind:'wrote',actor:'yuvi',branch:'fork:w',content:'秘密旧照片 🌙'});buildIndex(a.directory??join(root,'data'));const index=new ArchiveIndex(a.db,join(root,'data'));t.after(()=>index.close());
 const r=await check(a,'{"query":"旧照片"}','负责人',{index,tool:'recall'});
 assert.equal(r.meta.rules,'p9');assert.equal(r.meta.total,17);assert.equal(r.meta.result_seqs.length,10);assert.ok(r.meta.result_seqs.includes(last.seq));assert.match(r.content,/找到你写下的文字 17 段，返回 10 段。/);
 assert.ok(r.meta.rank_seqs.every(s=>s!==1&&s!==3));
 const fallback=await check(a,'{"query":"🌙"}','负责人',{index,tool:'recall'});
 assert.equal(fallback.meta.fallback,'no_terms');assert.deepEqual(fallback.meta.result_seqs,[old.seq,last.seq]);
 const scan=await check(a,'{}','负责人',{engine:'scan',tool:'recall'});assert.equal(scan.meta.result_seqs.length,10);assert.equal(scan.meta.total,17);
 assert.equal((await check(a,'{"query":3}','负责人',{index,tool:'recall'})).meta.invalid,true);
});

test('P9 S: exclusions, whole-item budgets, sorting, recency, no terms and scoped candidates',async t=>{
 const {root,a}=fixture(t);const old=wrote(a,'银杏叶夹在书里');const long=wrote(a,'银杏'.repeat(1200));const fg=wrote(a,'今天看到银杏');
 const h=a.append({class:'experience',kind:'heard',actor:'owner',content:'刚刚银杏'});const w=wrote(a,'银杏就在这段经历里',{from_seq:h.seq,through_seq:h.seq});
 const foreign=a.append({class:'inner',kind:'wrote',actor:'yuvi',content:'银杏秘密',scene:'qq:foreign'});
 buildIndex(join(root,'data'));const index=new ArchiveIndex(a.db,join(root,'data'));t.after(()=>index.close());
 for(const strategy of ['relevance','recency']){const r=index.surface('银杏',999,[fg],[h],strategy);
 assert.deepEqual(r.surfaced.map(e=>e.seq),[old.seq]);assert.ok(!r.surfacing.candidates.includes(foreign.seq));
 assert.deepEqual(new Set(r.surfacing.excluded.map(e=>e.why)),new Set(['foreground','window','budget']));}
 assert.equal(index.surface('🌙',999,[],[],'relevance').surfacing.reason,'no_terms');
 assert.equal(index.surface('不存在',999,[],[],'relevance').surfacing.reason,'no_candidates');
 assert.equal(index.surface('银杏',old.seq,[],[],'recency').surfacing.reason,'no_candidates');
});

test('P9 actual process: frozen surfaced base, mixed tool calls, usage once and exact historical reconstruction',async t=>{
 const root=mkdtempSync(join(tmpdir(),'yuvi-p9-service-'));t.after(()=>rmSync(root,{recursive:true,force:true}));const data=join(root,'data'),a=new Archive(data);
 const old=wrote(a,'旧照片放在抽屉 🌙');for(let i=0;i<8;i++)wrote(a,'无关的后来文字'.repeat(100));a.close();
 const captured=[];let step=0;
 const fake=createServer(async(req,res)=>{const chunks=[];for await(const c of req)chunks.push(c);const body=JSON.parse(Buffer.concat(chunks).toString('utf8'));captured.push(capturePresentation(data,body));
  if(!body.tools)return res.end(text('')+done());
  if(step++===0){assert.deepEqual(body.tools.map(x=>x.function.name),['stay_silent','check','recall']);res.end(frame({choices:[{delta:{tool_calls:[{index:0,id:'r',function:{name:'recall',arguments:'{"query":"旧照片"}'}},{index:1,id:'c',function:{name:'check',arguments:'{"query":"旧照片"}'}}]}}]})+done({prompt_tokens:7,completion_tokens:1}));}
  else if(step===2)res.end(tool('recall',{query:'🌙'})+done({prompt_tokens:5}));else res.end(text('看过以前的文字了。')+done({prompt_tokens:3}));
 });const base=await listen(fake);t.after(()=>new Promise(r=>fake.close(r)));
 const s=await startService(root,{data,baseUrl:base,recall:true,surfacing:'relevance',writing:1000});t.after(()=>s.stop());
 const frames=await s.post('旧照片还放在那里吗\0🌙😀�');assert.equal(frames.at(-1).event,'done');
 const events=assertPresentations(data,captured,'测试人设原文\n');const ps=events.filter(e=>e.kind==='presented');assert.equal(ps.length,3);
 assert.deepEqual(ps[0].meta.sections.find(s=>s.name==='surfaced').seqs,[old.seq]);
 for(const p of ps)assert.deepEqual(p.meta.surfacing,ps[0].meta.surfacing);
 const queries=events.filter(e=>['checked','recalled'].includes(e.kind));assert.deepEqual(queries.map(e=>e.kind),['recalled','checked','recalled']);assert.equal(queries.filter(e=>e.meta.usage).length,2);
 assert.deepEqual(queries[0].meta.result_seqs,[old.seq]);assert.ok(ps[1].meta.sections.at(-1).results[0].recalled);
 const usage=await(await fetch(s.url+'/api/usage')).json();assert.equal(events.filter(e=>e.kind==='said').length,1);assert.ok(usage);
});

test('P9 S4–S11: budgets, common/no candidates, recency order and failures do not silently scan',async t=>{
 const {root,a}=fixture(t);const small=[];for(let i=0;i<3;i++)small.push(wrote(a,'灯塔'+String(i)+'字'.repeat(897)));
 const oversized=wrote(a,'灯塔'+'字'.repeat(2098));a.append({class:'experience',kind:'heard',actor:'owner',content:'只有原话的鲸鱼'});
 buildIndex(join(root,'data'));const index=new ArchiveIndex(a.db,join(root,'data'));t.after(()=>index.close());
 const selected=index.surface('灯塔',Infinity,[],[],'recency');assert.equal(selected.surfaced.length,2);assert.equal(selected.surfacing.excluded.find(e=>e.seq===oversized.seq).why,'budget');assert.deepEqual(selected.surfaced.map(e=>e.seq),small.slice(1).map(e=>e.seq));
 const long=index.surface('灯塔',Infinity,small,[],'recency');assert.equal(long.surfacing.reason,'all_excluded');
 assert.ok((await check(a,'{"query":"灯塔"}','负责人',{index,tool:'recall'})).meta.result_seqs.includes(oversized.seq));
 assert.equal(index.surface('灯塔',Infinity,[],[],'relevance',0).surfacing.reason,'common');assert.equal(index.surface('鲸鱼',Infinity,[],[],'relevance').surfacing.reason,'no_candidates');
 const db=index.db;index.db={prepare(){throw Error('injected private content');},close(){}};const originalCatch=index.catchUp;index.catchUp=()=>{};
 try{assert.equal(index.surface('灯塔',Infinity,[],[],'relevance').surfacing.reason,'error');}finally{index.db=db;index.catchUp=originalCatch;}
 const {chmodSync}=await import('node:fs');chmodSync(index.file,0o400);assert.equal(index.surface('灯塔',Infinity,[],[],'relevance').surfacing.reason,'index_unavailable');
 const fallback=await check(a,'{"query":"灯塔"}','负责人',{index,tool:'recall',scan:(raw,owner,reason,name)=>index.scan(raw,owner,reason,name)});assert.equal(fallback.meta.engine,'scan');assert.ok(fallback.meta.result_seqs.includes(oversized.seq));
});

test('P9 V3/V4: forged foreign indexed row is rejected, archive unchanged, show cannot cross scope',async t=>{
 const {root,a}=fixture(t);wrote(a,'本场景的文字');const foreign=a.append({class:'inner',kind:'wrote',actor:'yuvi',scene:'qq',content:'秘密灯塔'});
 const foreignPresented=a.append({class:'control',kind:'presented',actor:'system',scene:'qq',meta:{rules:'p9'}});
 buildIndex(join(root,'data'));const index=new ArchiveIndex(a.db,join(root,'data'));t.after(()=>index.close());
 const {createHash}=await import('node:crypto'),db=index.db;db.prepare('INSERT INTO docs VALUES(?,?,?,?,?)').run(foreign.seq,'wrote',foreign.t_recorded,foreign.content.length,createHash('sha256').update(foreign.content).digest('hex').slice(0,16));db.prepare('INSERT INTO terms(rowid,words)VALUES(?,?)').run(foreign.seq,'灯塔');
 const before=a.events();assert.equal(index.surface('灯塔',Infinity,[],[],'relevance').surfaced.length,0);assert.deepEqual(a.events(),before);
 const {presentedShow}=await import('../dist/presented.js');assert.throws(()=>presentedShow(a.db,foreignPresented.seq,'',true),/^Error: Presented record not found\.$/);
});

test('P9 C3/K3/K5: invalid recall never queries, source failure remains fatal; third continuation only silence',async t=>{
 const {root,a}=fixture(t);wrote(a,'灯塔');buildIndex(join(root,'data'));const index=new ArchiveIndex(a.db,join(root,'data'));t.after(()=>index.close());
 const original=index.search;index.search=()=>{throw Error('should not query');};assert.equal((await check(a,'{"from":"2026-02-30"}','负责人',{index,tool:'recall'})).meta.invalid,true);index.search=original;
 const {assembleContext,recordedTimeZone}=await import('../dist/context.js');const h=a.append({class:'experience',kind:'heard',actor:'owner',content:'当前'}),config={persona:'test',recall:true,writingChars:2000};let assembly=assembleContext({purpose:'dialogue',selected:{writings:[],window:[h]},heard:h},config,Date.now(),recordedTimeZone(),22);
 for(let step=1;step<=3;step++){assembly=assembleContext({previous:assembly,previousId:'prior'+step,text:'',calls:[{id:'call',name:'recall',arguments:'{}'}],results:[{reference:{recalled:'result'+step},content:'文字'}]},config,Date.now(),recordedTimeZone(),22);assert.deepEqual(assembly.parameters.tools.map(t=>t.function.name),step===3?['stay_silent']:['stay_silent','check','recall']);}
 const source=index.source;index.source={prepare(){throw Error('private source failure');}};
 try{assert.throws(()=>index.surface('灯塔',Infinity,[],[],'relevance'),/^Error: Archive read failed\.$/);}finally{index.source=source;}
});

test('P9 configuration: recall defaults on, surfacing off; invalid values disclose only variable name',async t=>{
 const {loadConfig}=await import('../dist/config.js'),{writeFileSync}=await import('node:fs');const root=mkdtempSync(join(tmpdir(),'yuvi-p9-config-'));t.after(()=>rmSync(root,{recursive:true,force:true}));writeFileSync(join(root,'persona.txt'),'test');const saved={...process.env};
 try{Object.assign(process.env,{YUVI_DATA_DIR:join(root,'data'),YUVI_PERSONA_FILE:join(root,'persona.txt'),YUVI_MODEL:'offline-config',YUVI_MODEL_API_KEY:'fake-only',YUVI_MODEL_BASE_URL:'http://127.0.0.1:1/v1'});delete process.env.YUVI_RECALL;delete process.env.YUVI_SURFACING;let c=loadConfig();assert.equal(c.recall,true);assert.equal(c.surfacing,'off');
  for(const name of ['YUVI_RECALL','YUVI_SURFACING']){process.env[name]='private-invalid-value';assert.throws(()=>loadConfig(),new Error('Invalid configuration: '+name));delete process.env[name];}
  process.env.YUVI_RECALL='off';process.env.YUVI_SURFACING='recency';c=loadConfig();assert.equal(c.recall,false);assert.equal(c.surfacing,'recency');
 }finally{for(const k of Object.keys(process.env))if(!(k in saved))delete process.env[k];Object.assign(process.env,saved);}
});
