// A fresh process owns one simulated life. Production scheduling, HTTP and archive
// writes are exercised; the driver never calls selection or consolidation itself.
import { mock } from 'node:test';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdirSync,writeFileSync,statSync } from 'node:fs';
import { join,resolve } from 'node:path';
import { createApp } from '../dist/server.js';
import { loadLife,expand } from './life.mjs';
const [id,arm,outArg,daysArg,policy]=process.argv.slice(2),out=resolve(outArg),days=Number(daysArg??63);
if(!['A0','A1','A2'].includes(arm))throw Error('Invalid evaluation arm');
const life=loadLife(id);if(policy)life.writing_policy=policy;
const {events,start,end}=expand(life,days);mkdirSync(out,{recursive:false,mode:0o700});writeFileSync(join(out,'life.json'),JSON.stringify({...life,evaluation:{arm,days}},null,2)+'\n');
const frame=value=>'data: '+JSON.stringify(value)+'\n\n';
let current,ordinary=0,requests=0,idleConsolidations=0,pressureConsolidations=0,advancing=false;
const fake=createServer(async(req,res)=>{
 const chunks=[];for await(const c of req)chunks.push(c);const body=JSON.parse(Buffer.concat(chunks).toString('utf8'));requests++;
 let content='',tool_calls;
 if(!body.tools){
  if(advancing)idleConsolidations++;else pressureConsolidations++;
  if(life.writing_policy==='excerpt'){
   const material=body.messages.at(-2).content;
   const headers=[...material.matchAll(/(?:^|\n\n)\d{4}-\d{2}-\d{2} [^\n]+?：\n/g)];
   content=headers.flatMap((h,i)=>{
    if(!h[0].endsWith(life.owner_name+'说：\n'))return[];
    const text=material.slice(h.index+h[0].length,i+1<headers.length?headers[i+1].index:material.length);
    return[Array.from(text).slice(0,32).join('')];
   }).join('\n');
  }
 }else if(body.messages.some(m=>m.role==='tool'))content='我查了一下。';
 else if(current.type==='probe'&&arm!=='A0')tool_calls=[{index:0,id:'check-life',type:'function',function:{name:'check',arguments:JSON.stringify(current.query)}}];
 else if(current.type!=='probe'&&++ordinary%25===0)tool_calls=[{index:0,id:'silent-life',type:'function',function:{name:'stay_silent',arguments:'{}'}}];
 else content=['嗯，继续。','听到了。','接着说吧。'][ordinary%3];
 const usage={prompt_tokens:body.messages.reduce((n,m)=>n+m.content.length,0),completion_tokens:content.length};
 res.writeHead(200,{'content-type':'text/event-stream'});
 res.end(frame({choices:[{delta:tool_calls?{tool_calls}:{content}}]})+frame({choices:[{delta:{},finish_reason:tool_calls?'tool_calls':'stop'}],usage})+'data: [DONE]\n\n');
});fake.listen(0,'127.0.0.1');await once(fake,'listening');
mock.timers.enable({apis:['Date','setTimeout','setInterval'],now:start});
const config={dataDir:join(out,'data'),persona:'这是隔离的合成生活评测。',ownerName:life.owner_name,model:'offline-life',apiKey:'fake-offline-only',baseUrl:`http://127.0.0.1:${fake.address().port}/v1`,
 host:'127.0.0.1',port:0,contextEvents:life.config.YUVI_CONTEXT_EVENTS,writingChars:life.config.YUVI_CONTEXT_WRITING_CHARS,consolidationIdleMs:life.config.YUVI_CONSOLIDATION_IDLE_MS,
 consolidationMaxTokens:life.config.YUVI_CONSOLIDATION_MAX_TOKENS,idleTimeoutMs:60000,maxDurationMs:600000};
const app=createApp(config,undefined,{checkEngine:arm==='A1'?'scan':undefined});app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
const wall=performance.now(),url=`http://127.0.0.1:${app.server.address().port}`;
try{
 for(const event of events){
  advancing=true;mock.timers.tick(event.t-Date.now());await app.idle();await new Promise(r=>setImmediate(r));advancing=false;current=event;
  const response=await fetch(url+'/api/messages',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text:event.text})});
  const stream=await response.text();if(!/event: (done|silent)\n/.test(stream))throw Error('Evaluation turn did not complete normally');
  await app.idle();await new Promise(r=>setImmediate(r));
 }
 advancing=true;mock.timers.tick(end-Date.now());await app.idle();await new Promise(r=>setImmediate(r));
 writeFileSync(join(out,'run.json'),JSON.stringify({format:1,life:id,arm,days,writing_policy:life.writing_policy,owner_messages:events.length,requests,idle_consolidations:idleConsolidations,pressure_consolidations:pressureConsolidations,simulated_start:start,simulated_end:end},null,2)+'\n');
 writeFileSync(join(out,'timing.json'),JSON.stringify({wall_ms:performance.now()-wall,index_bytes:statSync(join(config.dataDir,'index.sqlite')).size},null,2)+'\n');
}finally{
 mock.timers.reset();app.server.closeAllConnections();await new Promise(r=>app.server.close(r));fake.closeAllConnections();await new Promise(r=>fake.close(r));await app.index.close();app.archive.close();
}
