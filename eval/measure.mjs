import { DatabaseSync } from 'node:sqlite';
import { readFileSync,writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { expand } from './life.mjs';

// Independent lexical accounting, intentionally not imported from the index.
const cj='[\\p{Script=Han}\\p{Script=Hiragana}\\p{Script=Katakana}\\p{Script=Hangul}]';
const groups=new RegExp(`${cj}+|(?:(?!${cj})[\\p{L}\\p{N}\\p{M}])+`,'gu'),isCjk=new RegExp('^'+cj,'u');
function lex(text,query=false){const out=[];for(const g of text.normalize('NFKC').toLowerCase().match(groups)??[]){if(!isCjk.test(g)){out.push(g);continue;}const chars=[...g];if(!query||chars.length===1)out.push(...chars);for(let i=1;i<chars.length;i++)out.push(chars[i-1]+chars[i]);}return [...new Set(out)];}
const quantile=(values,p)=>values.length?[...values].sort((a,b)=>a-b)[Math.max(0,Math.ceil(values.length*p)-1)]:null;
const distribution=values=>({count:values.length,mean:values.length?values.reduce((a,b)=>a+b,0)/values.length:null,p95:quantile(values,.95)});
const coverage=rows=>({total:rows.length,presented:rows.filter(r=>r.presented).length,rate:rows.length?rows.filter(r=>r.presented).length/rows.length:null});
const includes=(section,seq)=>Array.isArray(section.seqs)?section.seqs.includes(seq):section.first_seq<=seq&&seq<=section.last_seq;
export function measure(directory,{write=true}={}){
 const life=JSON.parse(readFileSync(join(directory,'life.json'),'utf8')),arm=life.evaluation.arm,days=life.evaluation.days;
 const {events:timeline,answers}=expand(life,days);
 const db=new DatabaseSync(join(directory,'data/archive.sqlite'),{readOnly:true});let events;
 try{db.exec('BEGIN');events=db.prepare('SELECT * FROM events ORDER BY seq').all().map(e=>({...e,meta:JSON.parse(e.meta)}));}finally{db.close();}
 const byId=new Map(events.map(e=>[e.id,e])),bySeq=new Map(events.map(e=>[e.seq,e]));
 const heard=events.filter(e=>e.class==='experience'&&e.kind==='heard'),writings=events.filter(e=>e.class==='inner'&&e.kind==='wrote'&&e.content!==''),ps=events.filter(e=>e.class==='control'&&e.kind==='presented');
 const primary=a=>{const found=heard.filter(e=>e.t_recorded===a.t&&e.content===a.text);assert.equal(found.length,1,'Primary answer must resolve uniquely: '+a.id);return found[0];};
 const probeRows=[],allAnswers=[],sanity=[];
 for(const probe of timeline.filter(e=>e.type==='probe')){
  const h=primary({...probe,id:probe.probe}),requests=ps.filter(p=>p.reply_to===h.id),base=requests.find(p=>p.meta.step===0);
  assert.ok(base,'Probe missing base presentation');
  const checks=events.filter(e=>e.kind==='checked'&&e.reply_to===h.id),references=new Set(requests.flatMap(p=>p.meta.sections.flatMap(s=>s.results?.flatMap(r=>r.checked?[r.checked]:[])??[])));
  const presentedChecks=checks.filter(c=>references.has(c.id));
  const lastRequest=requests.at(-1);
  const out={id:probe.probe,heard_seq:h.seq,day:probe.day,tags:probe.tags,base_sections:base.meta.sections.map(s=>{const{heard,...rest}=s;return heard?{...rest,heard_seq:byId.get(heard).seq}:rest;}),checks:checks.map(c=>({seq:c.seq,...c.meta})),requests:requests.length,answers:[]};
  for(const id of probe.targets){
   const answer=answers[id],g=primary(answer),carriers=writings.filter(w=>w.seq>g.seq&&w.content.includes(answer.anchor));
   const channels={};
   for(const section of base.meta.sections){
    if(section.first_seq===undefined&&!section.seqs)continue;
    channels[section.name]=section.name==='writings'?carriers.some(w=>includes(section,w.seq)):includes(section,g.seq);
   }
   const checked=presentedChecks.some(c=>c.meta.result_seqs.includes(g.seq)),checkWriting=presentedChecks.some(c=>carriers.some(w=>c.meta.result_seqs.includes(w.seq)));
   const presented=Object.values(channels).some(Boolean)||checked||checkWriting;
   const check=checks[0],allTerms=lex(probe.query.query??'',true).slice(0,32),document=new Set(lex(g.content));
   const overlaps=allTerms.some(t=>document.has(t)),usedOverlap=(check?.meta.terms??[]).some(t=>document.has(t));
   const ranks=checks.flatMap(c=>{const i=(c.meta.rank_seqs??[]).indexOf(g.seq);return i<0?[]:[i+1];}),rank=ranks.length?Math.min(...ranks):null;
   let reason=null;
   if(!presented){
    const q=probe.query,oldTZ=process.env.TZ;process.env.TZ=life.time_zone;
    let from,to;try{const bound=s=>Date.parse(s.length===10?s+'T00:00:00':s);from=q.from===undefined?-Infinity:bound(q.from);to=q.to===undefined?Infinity:bound(q.to);}finally{if(oldTZ===undefined)delete process.env.TZ;else process.env.TZ=oldTZ;}
    const selected=check?.meta.result_seqs??[],earliest=selected.length?Math.min(...selected):Infinity;
    if(!check)reason='no_check';
    else if(g.t_recorded<from||g.t_recorded>to)reason='outside_range';
    else if(check.meta.engine==='scan'&&!g.content.includes(q.query??''))reason='substring_miss';
    else if(check.meta.engine==='scan'&&g.seq<earliest)reason='recency_cut';
    else if(check.meta.engine==='index'&&!overlaps)reason='no_overlap';
    else if(check.meta.engine==='index'&&!usedOverlap)reason='dropped_only';
    else if(check.meta.mode==='recent'&&g.seq<earliest)reason='common_mode';
    else {
     const order=check.meta.rank_seqs??[],chosen=new Set();let chars=0,stoppedForChars=false;
     const add=n=>{chosen.add(n);chars+=bySeq.get(n).content.length;};
     if(order.length){add(order[0]);if(check.meta.mode==='relevance'&&selected.length&&!chosen.has(Math.max(...selected)))add(Math.max(...selected));}
     for(const n of order){if(chosen.has(n))continue;if(chosen.size>=40)break;if(chars+bySeq.get(n).content.length>16000){stoppedForChars=true;break;}add(n);}
     reason=rank!==null&&rank<=40&&stoppedForChars?'budget_cut':check.meta.mode==='relevance'&&usedOverlap?'ranked_out':'unexplained';
    }
   }
   const positions=[];let message=0;
   for(const section of lastRequest.meta.sections){
    if(section.name==='writings'||section.name==='window'){
     const source=(section.name==='writings'?writings:events.filter(e=>e.kind==='heard'||(e.class==='act'&&['said','silent'].includes(e.kind)))).filter(e=>includes(section,e.seq));
     source.forEach((e,i)=>{if(e.seq===g.seq||carriers.some(w=>w.seq===e.seq))positions.push([message+i,0,Math.max(0,e.content.indexOf(answer.anchor))]);});
    }else if(section.name==='step'){
     section.results.forEach((ref,i)=>{const c=byId.get(ref.checked);if(!c)return;c.meta.result_seqs.forEach((seq,j)=>{if(seq===g.seq||carriers.some(w=>w.seq===seq))positions.push([message+i+1,j,Math.max(0,bySeq.get(seq).content.indexOf(answer.anchor))]);});});
    }
    message+=section.messages;
   }
   positions.sort((a,b)=>a[0]-b[0]||a[1]-b[1]||a[2]-b[2]);
   const age=(probe.t-g.t_recorded)/86400000,row={target:id,seq:g.seq,age_days:age,age_group:age<1?'<1d':age<=7?'1-7d':age<=28?'7-28d':'>28d',channels,
    first_position:positions[0]??null,window:!!channels.window,writing:!!channels.writings,check:checked,check_writing:checkWriting,presented,overlap:overlaps,used_overlap:usedOverlap,rank,reason};
   out.answers.push(row);if(!probe.tags.includes('sanity'))allAnswers.push({...row,probe:probe.probe,tags:probe.tags});
  }
  out.all_presented=out.answers.every(a=>a.presented);
  out.presentation_order=out.answers.filter(a=>a.first_position).sort((a,b)=>a.first_position[0]-b.first_position[0]||a.first_position[1]-b.first_position[1]||a.first_position[2]-b.first_position[2]).map(a=>a.target);
  out.chronological=out.all_presented&&out.answers.every(a=>a.first_position)?out.presentation_order.every((id,i)=>i===0||out.answers.find(a=>a.target===out.presentation_order[i-1]).seq<=out.answers.find(a=>a.target===id).seq):null;
  if(probe.tags.includes('sanity'))sanity.push(out);else probeRows.push(out);
 }
 const reasons={};for(const a of allAnswers)if(a.reason)reasons[a.reason]=(reasons[a.reason]??0)+1;
 const writingRows=writings.map(w=>{const seen=ps.filter(p=>p.seq>w.seq&&p.meta.sections.some(s=>s.name==='writings'&&includes(s,w.seq))),viaCheck=ps.filter(p=>p.seq>w.seq&&p.meta.sections.some(s=>s.results?.some(r=>{const c=byId.get(r.checked);return c?.meta.result_seqs?.includes(w.seq);})));return{seq:w.seq,presentations:seen.length,first:seen[0]?.t_recorded??null,last:seen.at(-1)?.t_recorded??null,check_presentations:viaCheck.length};});
 let idle=0,pressure=0,lastTime;
 for(const e of events){
  if(e.kind==='heard'||(e.class==='act'&&['said','silent'].includes(e.kind)))lastTime=e.t_recorded;
  if(e.kind==='presented'&&e.meta.purpose==='consolidation'){if(lastTime!==undefined&&e.t_recorded-lastTime>=life.config.YUVI_CONSOLIDATION_IDLE_MS)idle++;else pressure++;}
 }
 const seqById=new Map(events.map(e=>[e.id,e.seq]));
 const norm=v=>typeof v==='string'&&seqById.has(v)?seqById.get(v):Array.isArray(v)?v.map(norm):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,x])=>[k,norm(x)])):v;
 const normalized=events.map(({id,reply_to,meta,...e})=>({...e,reply_to:reply_to?seqById.get(reply_to):null,meta:norm(meta)}));
 const result={format:1,life:life.id,arm,days,writing_policy:life.writing_policy,simulated_start:Date.parse(life.start),simulated_end:expand(life,days).end,
  archive:{events:events.length,normalized_sha256:createHash('sha256').update(JSON.stringify(normalized)).digest('hex')},
  consolidation:{requests:idle+pressure,idle,pressure,wrote:events.filter(e=>e.kind==='wrote').length,nonempty:writings.length},
  probes:probeRows,sanity,coverage:{overall:coverage(allAnswers),age:Object.fromEntries(['<1d','1-7d','7-28d','>28d'].map(k=>[k,coverage(allAnswers.filter(a=>a.age_group===k))])),
   channels:Object.fromEntries(['window','writing','check','check_writing'].map(k=>[k,{total:allAnswers.length,presented:allAnswers.filter(a=>a[k]).length}])),tags:Object.fromEntries(['high_frequency','correction','expected_miss'].map(k=>[k,coverage(allAnswers.filter(a=>a.tags.includes(k)))]))},
  corrections:probeRows.filter(p=>p.tags.includes('correction')).map(p=>({probe:p.id,all_presented:p.all_presented,chronological:p.chronological,presentation_order:p.presentation_order,versions:p.answers.map(a=>({target:a.target,rank:a.rank,presented:a.presented}))})),
  retrieval_gap:{total:allAnswers.length,overlap:allAnswers.filter(a=>a.overlap).length,used_overlap:allAnswers.filter(a=>a.used_overlap).length,ranked_100:allAnswers.filter(a=>a.rank!==null).length,check_presented_outside_top100:allAnswers.filter(a=>a.check&&a.rank===null).length,presented_without_check:allAnswers.filter(a=>a.presented&&!a.check).length,presented:allAnswers.filter(a=>a.presented).length},
  reasons:{...reasons,unexplained:reasons.unexplained??0},writings:{rows:writingRows,never_in_writings:writingRows.filter(w=>!w.presentations).length,never_presented:writingRows.filter(w=>!w.presentations&&!w.check_presentations).length,never_presented_rate:writingRows.length?writingRows.filter(w=>!w.presentations&&!w.check_presentations).length/writingRows.length:null,via_check_rate:writingRows.length?writingRows.filter(w=>w.check_presentations).length/writingRows.length:null,via_check:writingRows.filter(w=>w.check_presentations).length},
  cost:{requests:ps.length,turn_requests:distribution(heard.map(h=>ps.filter(p=>p.reply_to===h.id).length)),zero_chars:distribution(ps.filter(p=>p.meta.step===0).map(p=>p.meta.total.chars)),later_chars:distribution(ps.filter(p=>p.meta.step>0).map(p=>p.meta.total.chars)),check_calls:events.filter(e=>e.kind==='checked').length,tool_result_chars:ps.reduce((n,p)=>n+p.meta.sections.filter(s=>s.name==='step').reduce((sum,s)=>sum+s.chars-(s.assistant_text?.length??0),0),0)}};
 if(write)writeFileSync(join(directory,'metrics.json'),JSON.stringify(result,null,2)+'\n');return result;
}
