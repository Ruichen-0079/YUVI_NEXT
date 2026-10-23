import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { presentedShow, presentedSummary, presentedWritings } from '../../dist/presented.js';
export const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function readEvents(data) {
  const db=new DatabaseSync(join(data,'archive.sqlite'),{readOnly:true});
  try{return db.prepare('SELECT * FROM events ORDER BY seq').all().map(e=>({...e,meta:JSON.parse(e.meta)}));}finally{db.close();}
}
export function capturePresentation(data,body) {
  const db=new DatabaseSync(join(data,'archive.sqlite'),{readOnly:true});
  try {const row=db.prepare("SELECT seq,meta FROM events NOT INDEXED WHERE class='control' AND kind='presented' ORDER BY seq DESC LIMIT 1").get();
    assert.ok(row,'presentation must be committed before fake provider sees request');
    assert.equal(JSON.parse(row.meta).messages_sha256,digest(body.messages));return {seq:Number(row.seq),body};
  } finally {db.close();}
}
export function inferOutcome(p,events) {
  const later=events.filter(e=>e.seq>p.seq&&e.scene===p.scene&&e.branch===p.branch);
  if(p.meta.purpose==='dialogue'){
    if(later.some(e=>e.kind==='presented'&&e.meta.previous===p.id))return {status:'completed'};
    const end=later.find(e=>e.reply_to===p.reply_to&&['said','silent','error'].includes(e.kind));
    if(!end)return {status:'unknown'};
    if(end.kind!=='error')return {status:'completed'};
    return {status:'failed',...Object.fromEntries(['reason','outcome','http_status'].filter(k=>Object.hasOwn(end.meta,k)).map(k=>[k,end.meta[k]]))};
  }
  for(const e of later){if(e.kind==='presented'&&e.meta.purpose==='consolidation')break;
    const m=p.meta.sections.find(s=>s.name==='material');
    if(e.kind==='wrote'&&e.meta.material?.from_seq===m.first_seq&&e.meta.material?.through_seq===m.last_seq)return {status:'completed'};
  }return {status:'incomplete'};
}
export function cliPresented(data,personaFile,args) {
  return JSON.parse(execFileSync(process.execPath,['dist/maintenance.js','presented',...args],{
    env:{...process.env,YUVI_DATA_DIR:data,...(personaFile?{YUVI_PERSONA_FILE:personaFile}:{YUVI_PERSONA_FILE:''})},encoding:'utf8',maxBuffer:64*1024*1024}));
}
export function assertPresentations(data,captured,persona,{allowUnsent=false,cliFile}={}) {
  const events=readEvents(data),presented=events.filter(e=>e.kind==='presented');
  assert.equal(new Set(captured.map(c=>c.seq)).size,captured.length);
  if(!allowUnsent)assert.equal(presented.length,captured.length);
  const db=new DatabaseSync(join(data,'archive.sqlite'),{readOnly:true});
  try {
    for(const p of presented){
      const show=cliFile?cliPresented(data,cliFile,['show',String(p.seq),'--messages']):presentedShow(db,p.seq,persona,true);
      assert.equal(show.reconstruction.status,'exact',JSON.stringify(show));
      assert.deepEqual(show.outcome,inferOutcome(p,events));
      const actual=captured.find(c=>c.seq===p.seq);
      if(actual){const body=actual.body;
        assert.deepEqual(show.messages,body.messages);assert.equal(p.meta.messages_sha256,digest(body.messages));
        assert.deepEqual(p.meta.total,{messages:body.messages.length,chars:body.messages.reduce((n,m)=>n+m.content.length,0)});
        assert.equal(p.model,body.model);assert.deepEqual(p.meta.request.tools,body.tools?.map(t=>t.function.name)??[]);
        assert.equal(p.meta.request.max_tokens,body.max_tokens);
      }
      assert.equal(p.meta.sections.reduce((n,s)=>n+s.messages,0),p.meta.total.messages);
      assert.equal(p.meta.sections.reduce((n,s)=>n+s.chars,0),p.meta.total.chars);
      assert.ok(!Object.hasOwn(p.meta,'usage'));assert.equal(p.actor,'system');assert.equal(p.content,'');
      if(p.meta.purpose==='dialogue'&&p.meta.step===0)assert.ok(Buffer.byteLength(JSON.stringify(p.meta))<=1500);
    }
    const summary=presentedSummary(db);assert.equal(summary.count,presented.length);
    assert.equal(summary.meta_bytes.total,presented.reduce((n,p)=>n+Buffer.byteLength(JSON.stringify(p.meta)),0));
    const counts={};for(const p of presented){const k=inferOutcome(p,events).status;counts[k]=(counts[k]??0)+1;}assert.deepEqual(summary.by_status,counts);
    const stats=presentedWritings(db);let never=0;
    for(const w of stats.writings){const ps=presented.filter(p=>p.meta.sections.some(s=>s.name==='writings'&&s.first_seq<=w.seq&&s.last_seq>=w.seq));
      for(const purpose of ['dialogue','consolidation']){
        assert.equal(w[purpose],ps.filter(p=>p.meta.purpose===purpose).length);
        assert.equal(w[purpose+'_completed'],ps.filter(p=>p.meta.purpose===purpose&&inferOutcome(p,events).status==='completed').length);
      }
      assert.equal(w.first_presented,ps.length?Math.min(...ps.map(p=>p.t_recorded)):null);
      assert.equal(w.last_presented,ps.length?Math.max(...ps.map(p=>p.t_recorded)):null);
      if(!ps.length)never++;
    }assert.equal(stats.never_presented,never);
  } finally {db.close();}
  return events;
}
