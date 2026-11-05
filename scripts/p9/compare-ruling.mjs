// Read-only comparison of pre-ruling and corrected, independently simulated lives.
// Only the approved two-character prefix delta and its derived costs/digests may differ.
import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import {readFileSync} from 'node:fs';import {join,resolve} from 'node:path';import {createHash} from 'node:crypto';
const stats=values=>({count:values.length,mean:values.length?values.reduce((a,b)=>a+b,0)/values.length:null,p95:values.length?[...values].sort((a,b)=>a-b)[Math.ceil(values.length*.95)-1]:null});
const hash=v=>createHash('sha256').update(typeof v==='string'?v:JSON.stringify(v)).digest('hex');
function events(root,key){const db=new DatabaseSync(join(root,key,'data/archive.sqlite'),{readOnly:true});try{const rows=db.prepare('SELECT * FROM events ORDER BY seq').all().map(e=>({...e,meta:JSON.parse(e.meta)})),ids=new Map(rows.map(e=>[e.id,`event:${e.seq}`]));const norm=v=>typeof v==='string'?(ids.get(v)??v):Array.isArray(v)?v.map(norm):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,x])=>[k,norm(x)])):v;return norm(rows);}finally{db.close();}}
function metrics(root,key){return JSON.parse(readFileSync(join(root,key,'metrics.json'),'utf8'));}
export function compare(oldRoot,newRoot,regressRoot){const results={};for(const life of ['life-a','life-b'])for(const arm of ['E-R','E-S','E-SR','E-SC']){
 const key=`${life}-${arm}-excerpt`;for(const root of [oldRoot,newRoot,regressRoot])metrics(root,key);const old=events(oldRoot,key),fresh=events(newRoot,key),repeat=events(regressRoot,key);assert.equal(JSON.stringify(fresh)===JSON.stringify(repeat),true,`${key}: repeated archive changed`);
 assert.equal(old.length,fresh.length);let delta=0,changed=0,requests=0,usageDelta=0;
 const corrected=structuredClone(fresh);
 for(let i=0;i<old.length;i++){
  const a=old[i],b=corrected[i];assert.equal(a.kind,b.kind);
  if(a.kind==='presented'){
   requests++;const before=a.meta.sections.find(s=>s.name==='surfaced'),after=b.meta.sections.find(s=>s.name==='surfaced');assert.equal(!!before,!!after);delta=before?2:0;
   assert.equal(a.meta.total.chars-b.meta.total.chars,delta);
   if(delta){changed++;assert.equal(before.chars-after.chars,2);assert.notEqual(a.meta.messages_sha256,b.meta.messages_sha256);after.chars+=2;b.meta.total.chars+=2;b.meta.messages_sha256=a.meta.messages_sha256;}else assert.equal(a.meta.messages_sha256,b.meta.messages_sha256);
  }
  if(b.meta.usage){assert.equal(a.meta.usage.prompt_tokens-b.meta.usage.prompt_tokens,delta);b.meta.usage.prompt_tokens+=delta;usageDelta+=delta;}
  assert.deepEqual(b,a,`${key}: unexpected event difference at ${a.seq}`);
 }
 const a=metrics(oldRoot,key),b=metrics(newRoot,key),r=metrics(regressRoot,key);assert.deepEqual(b,r);
 const presentations=old.filter(e=>e.kind==='presented'),bases=presentations.filter(e=>e.meta.step===0),chars=p=>p.meta.total.chars-(p.meta.sections.some(s=>s.name==='surfaced')?2:0);
 assert.deepEqual(b.surfacing.chars,stats(bases.map(p=>{const s=p.meta.sections.find(s=>s.name==='surfaced');return s?s.chars-2:0;})));
 assert.deepEqual(b.cost.zero_chars,stats(bases.map(chars)));assert.deepEqual(b.cost.later_chars,stats(presentations.filter(p=>p.meta.step>0).map(chars)));
 const turnChars=stats(old.filter(e=>e.kind==='heard').map(h=>presentations.filter(p=>p.reply_to===h.id).reduce((sum,p)=>sum+chars(p),0)));
 const beforeCost=JSON.parse(readFileSync(join(oldRoot,'baseline.json'),'utf8')).runs[key].p9cost,afterCost=JSON.parse(readFileSync(join(newRoot,'baseline.json'),'utf8')).runs[key].p9cost;
 assert.deepEqual(b.p9cost.turn_chars,turnChars);assert.deepEqual(afterCost.vs_p8_a0,{baseline:beforeCost.vs_p8_a0.baseline,mean_delta:turnChars.mean-beforeCost.vs_p8_a0.baseline.mean,p95_delta:turnChars.p95-beforeCost.vs_p8_a0.baseline.p95});
 assert.ok(b.p9cost.manifest_bytes.max<=2500);assert.ok(b.p9cost.structural_bytes_max<=2500);
const strip=(v,corrected)=>{const c=structuredClone(v);delete c.p9cost;delete c.surfacing.chars;delete c.archive.normalized_sha256;for(const name of ['zero_chars','later_chars']){delete c.cost[name].mean;delete c.cost[name].p95;}
  if(corrected)for(const probe of [...c.probes,...c.sanity]){const section=probe.base_sections.find(s=>s.name==='surfaced');if(section){section.chars+=2;for(const call of [...probe.checks,...probe.recalls])if(call.usage)call.usage.prompt_tokens+=2;}}return c;};assert.deepEqual(strip(a,false),strip(b,true),`${key}: research metrics changed`);
 const first=readFileSync(join(newRoot,key,'requests.json'),'utf8'),second=readFileSync(join(regressRoot,key,'requests.json'),'utf8');assert.equal(first,second);
 results[key]={events:fresh.length,requests,prefix_changed_requests:changed,request_chars_saved:changed*2,fake_prompt_tokens_saved:usageDelta,research_metrics_unchanged:true,metrics_sha256:hash(JSON.stringify(b,null,2)+'\n'),normalized_archive_sha256:hash(fresh),request_trace_sha256:hash(first)};
 }return {old_root:oldRoot,baseline_root:newRoot,regress_root:regressRoot,runs:results};}
if(process.argv[1]&&resolve(process.argv[1])===new URL(import.meta.url).pathname)console.log(JSON.stringify(compare(...process.argv.slice(2)),null,2));
