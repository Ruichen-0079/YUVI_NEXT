// Read-only comparison of pre-ruling and corrected, independently simulated lives.
// Only the approved two-character prefix delta and its derived costs/digests may differ.
import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import {readFileSync} from 'node:fs';import {join,resolve} from 'node:path';import {createHash} from 'node:crypto';
const hash=v=>createHash('sha256').update(typeof v==='string'?v:JSON.stringify(v)).digest('hex');
function events(root,key){const db=new DatabaseSync(join(root,key,'data/archive.sqlite'),{readOnly:true});try{const rows=db.prepare('SELECT * FROM events ORDER BY seq').all().map(e=>({...e,meta:JSON.parse(e.meta)})),ids=new Map(rows.map(e=>[e.id,`event:${e.seq}`]));const norm=v=>typeof v==='string'?(ids.get(v)??v):Array.isArray(v)?v.map(norm):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,x])=>[k,norm(x)])):v;return norm(rows);}finally{db.close();}}
function metrics(root,key){return JSON.parse(readFileSync(join(root,key,'metrics.json'),'utf8'));}
export function compare(oldRoot,newRoot,regressRoot){const results={};for(const life of ['life-a','life-b'])for(const arm of ['E-R','E-S','E-SR','E-SC']){
 const key=`${life}-${arm}-excerpt`,old=events(oldRoot,key),fresh=events(newRoot,key),repeat=events(regressRoot,key);assert.deepEqual(fresh,repeat,`${key}: repeated archive changed`);
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
 const a=metrics(oldRoot,key),b=metrics(newRoot,key),r=metrics(regressRoot,key);assert.deepEqual(b,r);const strip=v=>{const c=structuredClone(v);delete c.p9cost;delete c.surfacing.chars;return c;};assert.deepEqual(strip(a),strip(b),`${key}: research metrics changed`);
 const first=readFileSync(join(newRoot,key,'requests.json'),'utf8'),second=readFileSync(join(regressRoot,key,'requests.json'),'utf8');assert.equal(first,second);
 results[key]={events:fresh.length,requests,prefix_changed_requests:changed,request_chars_saved:changed*2,fake_prompt_tokens_saved:usageDelta,research_metrics_unchanged:true,metrics_sha256:hash(JSON.stringify(b,null,2)+'\n'),normalized_archive_sha256:hash(fresh),request_trace_sha256:hash(first)};
 }return {old_root:oldRoot,baseline_root:newRoot,regress_root:regressRoot,runs:results};}
if(process.argv[1]&&resolve(process.argv[1])===new URL(import.meta.url).pathname)console.log(JSON.stringify(compare(...process.argv.slice(2)),null,2));
