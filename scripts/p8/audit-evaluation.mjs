// Independent archive accounting: does not import the product, runner or measure.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync,writeFileSync,readdirSync } from 'node:fs';
import { join,resolve } from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const root=resolve(process.argv[2]),audits=[];
const inside=(s,n)=>Array.isArray(s.seqs)?s.seqs.includes(n):s.first_seq<=n&&n<=s.last_seq;
for(const name of readdirSync(root).filter(n=>/^life-[ab]-A[012]-(excerpt|none)$/.test(n)).sort()){
 const dir=join(root,name),life=JSON.parse(readFileSync(join(dir,'life.json'),'utf8')),m=JSON.parse(readFileSync(join(dir,'metrics.json'),'utf8'));
 const db=new DatabaseSync(join(dir,'data/archive.sqlite'),{readOnly:true});let events;
 try{db.exec('BEGIN');events=db.prepare('SELECT * FROM events ORDER BY seq').all().map(e=>({...e,meta:JSON.parse(e.meta)}));assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');}finally{db.close();}
 const owner=events.filter(e=>e.class==='experience'&&e.kind==='heard'),presentations=events.filter(e=>e.class==='control'&&e.kind==='presented'),writings=events.filter(e=>e.class==='inner'&&e.kind==='wrote'&&e.content.length>0),ids=new Map(events.map(e=>[e.id,e.seq])),byId=new Map(events.map(e=>[e.id,e]));
 const midnight=Date.parse(life.start)-8*3600000,time=v=>midnight+(v.day-1)*86400000+Number(v.time.slice(0,2))*3600000+Number(v.time.slice(3))*60000;
 const answers=new Map();for(const f of [...life.facts,...life.people])for(const v of f.versions??f.mentions){const found=owner.filter(e=>e.t_recorded===time(v)&&(v.text===null?e.content.length===v.generated_length&&e.content.endsWith('最后提一句，备用钥匙放在蓝色鞋盒里。'):e.content===v.text));assert.equal(found.length,1);answers.set(f.id+v.version,{event:found[0],anchor:v.anchor});}
 for(const s of life.sanity){const found=owner.filter(e=>e.t_recorded===time(s)&&e.content===s.text);assert.equal(found.length,1);answers.set(s.id,{event:found[0],anchor:s.anchor});}
 let total=0,shown=0;const channels={window:0,writing:0,check:0,check_writing:0};
 for(const p of [...m.probes,...m.sanity]){
  const h=events.find(e=>e.seq===p.heard_seq);assert.equal(h.kind,'heard');const requests=presentations.filter(e=>e.reply_to===h.id),base=requests.find(e=>e.meta.step===0);assert.ok(base);
  const referenced=new Set(requests.flatMap(e=>e.meta.sections.flatMap(s=>s.results??[]).filter(r=>r.checked).map(r=>r.checked))),checks=events.filter(e=>e.kind==='checked'&&e.reply_to===h.id),used=checks.filter(e=>referenced.has(e.id));
  assert.equal(checks.length,life.evaluation.arm==='A0'?0:1);assert.equal(requests.length,life.evaluation.arm==='A0'?1:2);
  for(const check of checks){const expected=life.probes.find(v=>v.id===p.id)?.query??{query:'暗号'};assert.deepEqual(check.meta.arguments,expected);assert.equal(check.meta.engine,life.evaluation.arm==='A1'||expected.query==='🎉'?'scan':'index');}
  for(const a of p.answers){const source=answers.get(a.target);assert.equal(a.seq,source.event.seq);const carriers=writings.filter(w=>w.seq>source.event.seq&&w.content.includes(source.anchor));
   const expected={window:base.meta.sections.some(s=>s.name==='window'&&inside(s,a.seq)),writing:base.meta.sections.some(s=>s.name==='writings'&&carriers.some(w=>inside(s,w.seq))),check:used.some(c=>c.meta.result_seqs.includes(a.seq)),check_writing:used.some(c=>carriers.some(w=>c.meta.result_seqs.includes(w.seq)))};
   for(const key of Object.keys(expected))assert.equal(a[key],expected[key],name+'/'+p.id+'/'+a.target+'/'+key);
   assert.equal(a.presented,Object.values(expected).some(Boolean));const ranks=checks.flatMap(c=>c.meta.rank_seqs.indexOf(a.seq)<0?[]:[c.meta.rank_seqs.indexOf(a.seq)+1]);assert.equal(a.rank,ranks.length?Math.min(...ranks):null);
   if(!p.tags.includes('sanity')){total++;shown+=Number(a.presented);for(const key of Object.keys(expected))channels[key]+=Number(expected[key]);}
  }
 }
 assert.equal(m.coverage.overall.total,total);assert.equal(m.coverage.overall.presented,shown);for(const key of Object.keys(channels))assert.equal(m.coverage.channels[key].presented,channels[key]);
 for(const row of m.writings.rows){const after=presentations.filter(p=>p.seq>row.seq),direct=after.filter(p=>p.meta.sections.some(s=>s.name==='writings'&&inside(s,row.seq))),checked=after.filter(p=>p.meta.sections.some(s=>(s.results??[]).some(r=>byId.get(r.checked)?.meta.result_seqs?.includes(row.seq))));assert.equal(row.presentations,direct.length);assert.equal(row.check_presentations,checked.length);assert.equal(row.first,direct[0]?.t_recorded??null);assert.equal(row.last,direct.at(-1)?.t_recorded??null);}
 const replace=v=>typeof v==='string'&&ids.has(v)?ids.get(v):Array.isArray(v)?v.map(replace):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,value])=>[k,replace(value)])):v;
 const normalized=events.map(({id,reply_to,meta,...row})=>({...row,reply_to:reply_to?ids.get(reply_to):null,meta:replace(meta)}));assert.equal(createHash('sha256').update(JSON.stringify(normalized)).digest('hex'),m.archive.normalized_sha256);
 assert.equal(m.cost.requests,presentations.length);assert.equal(m.cost.check_calls,events.filter(e=>e.kind==='checked').length);assert.equal(m.sanity.length,7);assert.ok(m.sanity.every(p=>p.all_presented));
 audits.push({run:name,owner_messages:owner.length,events:events.length,answers:total,presented:shown,channels,normalised_archive_sha256:m.archive.normalized_sha256,passed:true});
}
assert.equal(audits.length,8);writeFileSync(join(root,'independent-audit.json'),JSON.stringify({format:1,audits},null,2)+'\n');console.log(JSON.stringify({runs:audits.length,passed:true}));
