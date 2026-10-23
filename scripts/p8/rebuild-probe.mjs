import { createServer } from 'node:http';
import { mkdirSync,copyFileSync,writeFileSync } from 'node:fs';
import { resolve,join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { performance } from 'node:perf_hooks';
import { setTimeout as delay } from 'node:timers/promises';
import { startService,listen,text,tool,done } from '../../test/helpers/p6-process.mjs';
import { createSnapshot } from '../../dist/snapshots.js';
const[source,out]=process.argv.slice(2),root=resolve(out);mkdirSync(root,{recursive:false,mode:0o700});
const data=join(root,'data');mkdirSync(data);copyFileSync(source,join(data,'archive.sqlite'));createSnapshot({dataDir:data,snapshotDir:join(root,'snapshots')});
let checking=false;const fake=createServer(async(req,res)=>{const chunks=[];for await(const c of req)chunks.push(c);const body=JSON.parse(Buffer.concat(chunks).toString('utf8'));
res.end(!body.tools?text('写下测试经历')+done():checking&&!body.messages.some(m=>m.role==='tool')?tool('check',{query:'重建',from:new Date(Date.now()-300000).toISOString()})+done():text('正常结束')+done());});
const base=await listen(fake),started=performance.now(),service=await startService(root,{data,baseUrl:base,snapshots:join(root,'snapshots'),context:200});
const samples=[],pending=new Set(),failures=[],turns=[];let active=true;
const timer=setInterval(()=>{if(!active)return;const t=performance.now(),p=fetch(service.url+'/health').then(r=>{samples.push(performance.now()-t);if(!r.ok)failures.push(r.status);}).catch(()=>failures.push('connection'));pending.add(p);void p.finally(()=>pending.delete(p));},100);
try{
 for(let i=0;i<20;i++){checking=i%4===0;const frames=await service.post('重建期间继续对话'+i);turns.push({check:checking,last:frames.at(-1).event,elapsed_ms:frames.at(-1).at-frames.sentAt});}
 const deadline=performance.now()+300000;let through=0,last=0;
 while(performance.now()<deadline){try{const db=new DatabaseSync(join(data,'index.sqlite'),{readOnly:true});try{through=JSON.parse(db.prepare("SELECT value FROM metadata WHERE key='through_seq'").get().value);}finally{db.close();}}catch{}
  const source=new DatabaseSync(join(data,'archive.sqlite'),{readOnly:true});try{last=Number(source.prepare("SELECT max(seq) n FROM events WHERE kind IN ('heard','said','silent','wrote')").get().n);}finally{source.close();}
  if(through>=last)break;await delay(100);
 }
 active=false;clearInterval(timer);await Promise.allSettled([...pending]);
 const sorted=[...samples].sort((a,b)=>a-b),p99=sorted[Math.ceil(sorted.length*.99)-1];
 const result={node:process.version,elapsed_ms:performance.now()-started,through_seq:through,last_seq:last,health:{samples,p99_ms:p99,max_ms:Math.max(...samples),failures},turns,passed:through>=last&&p99<=100&&!failures.length&&turns.every(t=>t.last==='done')};
 writeFileSync(join(root,'results.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({elapsed_ms:result.elapsed_ms,health_p99_ms:p99,passed:result.passed}));if(!result.passed)process.exitCode=1;
}finally{active=false;clearInterval(timer);await service.stop();await new Promise(r=>fake.close(r));}
