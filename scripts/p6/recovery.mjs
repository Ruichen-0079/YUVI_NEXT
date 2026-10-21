// Real-process F6 checks on the million-event typical archive; no full event decoding.
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdir, copyFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { createSnapshot, verifySnapshot, restoreSnapshot } from '../../dist/snapshots.js';
import { startService } from '../../test/helpers/p6-process.mjs';
const dialogue="((class='experience' AND kind='heard') OR (class='act' AND kind IN ('said','silent')))";
function read(data,fn){const db=new DatabaseSync(join(data,'archive.sqlite'),{readOnly:true});try{return fn(db);}finally{db.close();}}
function progress(data){return read(data,db=>{
 const covered=Number(db.prepare("SELECT max(CAST(json_extract(meta,'$.material.through_seq') AS REAL)) c FROM events WHERE scene='web' AND branch='dev:v2-dev' AND ((class='inner' AND kind='wrote') OR (class='control' AND kind='unconsolidated'))").get().c??0);
 const count=Number(db.prepare(`SELECT count(*) n FROM events WHERE scene='web' AND branch='dev:v2-dev' AND ${dialogue}`).get().n);
 const coveredCount=Number(db.prepare(`SELECT count(*) n FROM events WHERE seq<=? AND scene='web' AND branch='dev:v2-dev' AND ${dialogue}`).get(covered).n);
 return{covered,count,coveredCount,maxSeq:Number(db.prepare('SELECT max(seq) n FROM events').get().n)};
});}
function tail(data,after){return read(data,db=>db.prepare('SELECT * FROM events WHERE seq>? ORDER BY seq').all(after).map(e=>({...e,meta:JSON.parse(e.meta)})));}
function deadline(promise,ms=15000){return Promise.race([promise,new Promise((_,reject)=>{const timer=setTimeout(()=>reject(Error('Recovery probe deadline')),ms);timer.unref();})]);}
export async function recoveryChecks(ctx){
 const {root,data,base,snapshots,turn}=ctx;const report={};const hook=join(root,'recovery-clock.mjs');await writeFile(hook,'Date.now = () => 1792584000000;\n');
 let service=await startService(root,{data,baseUrl:base,context:200,hook,snapshots});
 try{
  let last;
  for(let i=0;i<110;i++){
   last=await turn(service,'重启前-'+i);
   const p=progress(data),previous=Math.max(0,Math.ceil((p.count-1-200)/200)*200),next=Math.max(0,Math.ceil((p.count+1-200)/200)*200);
   if(previous===next&&next<=p.coveredCount)break;
   if(i===109)throw Error('Could not select stable P4 restart boundary');
  }
  const previous=last.captured.find(c=>c.body.tools).body.messages.slice(0,-1);await service.stop();
  service=await startService(root,{data,baseUrl:base,context:200,hook,snapshots});
  const next=await turn(service,'重启后');assert.deepEqual(next.captured.find(c=>c.body.tools).body.messages.slice(0,previous.length),previous);
  report.sigterm_prefix=true;
  // Actual partial send followed by SIGKILL, then P4 recovery updates the rebuilt state.
  const before=progress(data).maxSeq;let reached;const barrier=new Promise(r=>{reached=r;});ctx.setHangReply(reached);ctx.setMode('hang-reply');
  const response=await fetch(service.url+'/api/messages',{method:'POST',body:JSON.stringify({text:'SIGKILL 中断'})});
  const reader=response.body.getReader();let bytes='';
  while(!bytes.includes('event: delta')){const chunk=await reader.read();bytes+=Buffer.from(chunk.value).toString();}
  await deadline(barrier);await service.stop('SIGKILL');await reader.cancel().catch(()=>{});ctx.setMode('normal');
  service=await startService(root,{data,baseUrl:base,context:200,hook,snapshots});
  const recovered=tail(data,before),error=recovered.find(e=>e.kind==='error');assert.equal(error.meta.reason,'interrupted');assert.equal(error.meta.outcome,'unknown');
  const continued=await turn(service,'中断后继续');assert.equal(continued.frames.at(-1).event,'done');report.sigkill_recovery=true;
 }finally{await service.stop();}
 const snapshot=createSnapshot({dataDir:data,snapshotDir:join(root,'recovery-snapshots')});verifySnapshot(snapshot);
 const target=join(root,'restored');restoreSnapshot(snapshot,target);const old=progress(data),clone=progress(target);assert.equal(old.covered,clone.covered);
 const first=[];
 for(const directory of [data,target]){
  service=await startService(root,{data:directory,baseUrl:base,context:200,hook,snapshots});
  try{const run=await turn(service,'从相同历史继续');first.push(run.captured.find(c=>c.body.tools).body);}finally{await service.stop();}
 }
 assert.deepEqual(first[0],first[1]);report.snapshot_first_request_equal=true;
 // Separate copy of the same million-event data: kill a pressure consolidation.
 const interrupted=join(root,'consolidation-interrupted');await mkdir(interrupted);await copyFile(join(data,'archive.sqlite'),join(interrupted,'archive.sqlite'));
 service=await startService(root,{data:interrupted,baseUrl:base,context:20,hook,snapshots});
 let pendingPost,oldProgress,firstSeq;
 try{
  let reached;const barrier=new Promise(r=>{reached=r;});ctx.setHangConsolidation(reached);ctx.setMode('hang-consolidation');
  // Requests keep running until pressure actually starts a consolidation. The last
  // response is intentionally left pending; other calls end normally.
  for(let i=0;i<30;i++){
   oldProgress=progress(interrupted);
   const posted=fetch(service.url+'/api/messages',{method:'POST',body:JSON.stringify({text:'整理中断前-'+i})});
   const response=await posted;const collected=response.text().catch(()=>null);
   const winner=await Promise.race([barrier.then(()=>true),collected.then(()=>false)]);
   if(winner){pendingPost=collected;firstSeq=read(interrupted,db=>Number(db.prepare(`SELECT seq FROM events WHERE seq>? AND scene='web' AND branch='dev:v2-dev' AND ${dialogue} ORDER BY seq LIMIT 1`).get(oldProgress.covered).seq));break;}
  }
  assert.ok(firstSeq);await service.stop('SIGKILL');await pendingPost;ctx.setMode('normal');
  service=await startService(root,{data:interrupted,baseUrl:base,context:20,hook,snapshots});
  await turn(service,'整理恢复后继续');const appended=tail(interrupted,oldProgress.maxSeq);
  const writes=appended.filter(e=>e.kind==='wrote');assert.ok(writes.length);assert.equal(writes[0].meta.material.from_seq,firstSeq);
  let through=oldProgress.covered;
  for(const write of writes){
    const nextSeq=read(interrupted,db=>Number(db.prepare(`SELECT seq FROM events WHERE seq>? AND scene='web' AND branch='dev:v2-dev' AND ${dialogue} ORDER BY seq LIMIT 1`).get(through).seq));
    assert.equal(write.meta.material.from_seq,nextSeq);through=write.meta.material.through_seq;
  }
  assert.ok(appended.some(e=>e.kind==='error'&&e.meta.reason==='interrupted'));report.consolidation_sigkill_same_start=true;
  report.resumed_material_ranges=writes.map(e=>e.meta.material);
 }finally{await service.stop();ctx.setMode('normal');}
 return report;
}
