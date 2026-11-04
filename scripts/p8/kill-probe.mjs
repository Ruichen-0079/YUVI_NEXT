// Real process kills at transaction boundaries, using only a supplied synthetic fixture.
import { mkdirSync,copyFileSync,writeFileSync,existsSync,unlinkSync } from 'node:fs';
import { join,resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { setTimeout as delay } from 'node:timers/promises';
import { Archive } from '../../dist/archive.js';
import { buildIndex,verifyIndex } from '../../dist/archive-index.js';
import { startService,listen,text,done } from '../../test/helpers/p6-process.mjs';
const [source,out,only]=process.argv.slice(2),root=resolve(out);mkdirSync(root,{recursive:false,mode:0o700});
function facts(dir){const db=new DatabaseSync(join(dir,'archive.sqlite'),{readOnly:true});try{db.exec('BEGIN');let n=0;const hash=createHash('sha256');for(const row of db.prepare('SELECT *,hex(CAST(content AS BLOB)) content_bytes FROM events ORDER BY seq').iterate()){hash.update(JSON.stringify(row)+'\n');n++;}return{rows:n,sha256:hash.digest('hex'),schema:db.prepare('SELECT * FROM sqlite_master ORDER BY name').all(),integrity:db.prepare('PRAGMA integrity_check').get().integrity_check};}finally{db.close();}}
async function until(fn,limit=300000){const end=performance.now()+limit;while(performance.now()<end){if(await fn())return;await delay(100);}throw Error('Probe timeout');}
const fake=createServer(async(req,res)=>{for await(const _ of req){}res.end(text('正常回复')+done());});const base=await listen(fake),results={node:process.version};
try{
 for(const scenario of (only==='--increment-only'?['increment']:['rebuild','increment'])){
  const data=join(root,scenario);mkdirSync(data);let a;
  if(scenario==='rebuild')copyFileSync(source,join(data,'archive.sqlite'));
  else {a=new Archive(data);for(let i=0;i<20;i++){const h=a.append({class:'experience',kind:'heard',actor:'owner',content:'基准'+i});a.append({class:'act',kind:'silent',actor:'yuvi',reply_to:h.id});}a.append({class:'inner',kind:'wrote',actor:'yuvi',content:'',meta:{material:{from_seq:1,through_seq:40},finish_reason:'stop'}});buildIndex(data);a.close();}
  const clockDb=new DatabaseSync(join(data,'archive.sqlite'),{readOnly:true});let now;
  try{now=Number(clockDb.prepare('SELECT max(t_recorded) t FROM events').get().t)+1;}finally{clockDb.close();}
  const clockHook=join(root,scenario+'-clock.mjs');writeFileSync(clockHook,`Date.now=()=>${now};`);
  const armed=join(root,scenario+'-armed'),entered=join(root,scenario+'-entered'),hook=join(root,scenario+'-hook.mjs');
  writeFileSync(hook,`Date.now=()=>${now};import{DatabaseSync}from'node:sqlite';import{existsSync,writeFileSync}from'node:fs';const prepare=DatabaseSync.prototype.prepare;DatabaseSync.prototype.prepare=function(sql){const st=prepare.call(this,sql);if(sql==='UPDATE metadata SET value=? WHERE key=?'){const run=st.run;st.run=function(...args){if(args[1]==='through_seq'&&existsSync(${JSON.stringify(armed)})){writeFileSync(${JSON.stringify(entered)},'transaction open');process.kill(process.pid,'SIGSTOP');}return run.apply(this,args);};}return st;};`);
  const before=facts(data);if(scenario==='rebuild')writeFileSync(armed,'armed');
  let s=await startService(root,{data,baseUrl:base,hook}),pending;
  try{
   if(scenario==='increment'){writeFileSync(armed,'armed');pending=s.post('事务期间最后一条消息').catch(()=>null);}
   await until(()=>existsSync(entered),20000);
   const atKill=facts(data);if(scenario==='increment'){const db=new DatabaseSync(join(data,'archive.sqlite'),{readOnly:true});try{if(db.prepare('SELECT kind FROM events ORDER BY seq DESC LIMIT 1').get().kind!=='said')throw Error('Increment killed before turn terminal');}finally{db.close();}}
   await s.stop('SIGKILL');await pending;unlinkSync(armed);
   s=await startService(root,{data,baseUrl:base,hook:clockHook});
   await until(()=>{const db=new DatabaseSync(join(data,'archive.sqlite'),{readOnly:true});try{return verifyIndex(db,join(data,'index.sqlite')).status==='ok';}finally{db.close();}});
   const db=new DatabaseSync(join(data,'archive.sqlite'),{readOnly:true});let full;try{full=verifyIndex(db,join(data,'index.sqlite'),true);}finally{db.close();}
   const after=facts(data),expected=scenario==='rebuild'?before:atKill;
   results[scenario]={before,at_kill:atKill,after,verification:full,passed:after.sha256===expected.sha256&&after.rows===expected.rows&&full.status==='ok'&&after.integrity==='ok'};
   writeFileSync(join(root,'results.json'),JSON.stringify(results,null,2)+'\n');
   if(!results[scenario].passed)throw Error('Archive or index changed unexpectedly');
  }finally{await s.stop(existsSync(armed)?'SIGKILL':'SIGTERM');}
 }
 console.log(JSON.stringify({rebuild:results.rebuild?.passed,increment:results.increment?.passed}));
}finally{await new Promise(r=>fake.close(r));}
