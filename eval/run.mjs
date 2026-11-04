// A fresh process owns one simulated life. Production scheduling, HTTP and archive
// writes are exercised; the driver never calls selection or consolidation itself.
import { mock } from 'node:test';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdirSync,writeFileSync,statSync } from 'node:fs';
import { join,resolve } from 'node:path';
import { createApp } from '../dist/server.js';
import { realPlan,UsageBudget } from './real-guard.mjs';
import { loadLife,expand } from './life.mjs';
const [id,arm,outArg,daysArg,policy,mode]=process.argv.slice(2),out=resolve(outArg),days=Number(daysArg??63);
if(!['A0','A1','A2','E-R','E-S','E-SR','E-SC','R0','R1','R2'].includes(arm))throw Error('Invalid evaluation arm');
const real=mode==='real';
const plan=real?realPlan(['--arm',arm,'--out',out,'--max-input-tokens',process.env.YUVI_EVAL_MAX_INPUT,'--max-output-tokens',process.env.YUVI_EVAL_MAX_OUTPUT]):null;
if(real&&id!=='life-r')throw Error('Real experiments require life-r');
if(real)for(const name of ['YUVI_MODEL_BASE_URL','YUVI_MODEL_API_KEY','YUVI_MODEL'])if(!process.env[name])throw Error('Missing real experiment configuration: '+name);
const budget=plan?new UsageBudget(plan):null;
const life=loadLife(id);if(policy)life.writing_policy=policy;
const {events,start,end}=expand(life,days);mkdirSync(out,{recursive:false,mode:0o700});writeFileSync(join(out,'life.json'),JSON.stringify({...life,evaluation:{arm,days}},null,2)+'\n');
const frame=value=>'data: '+JSON.stringify(value)+'\n\n';
const requestEvidence=[];
let current,ordinary=0,requests=0,idleConsolidations=0,pressureConsolidations=0,advancing=false;
const fake=createServer(async(req,res)=>{
 const chunks=[];for await(const c of req)chunks.push(c);const body=JSON.parse(Buffer.concat(chunks).toString('utf8'));requests++;
 const presented=app.archive.db.prepare("SELECT seq,meta FROM events WHERE kind='presented' ORDER BY seq DESC LIMIT 1").get();const digest=createHash('sha256').update(JSON.stringify(body.messages)).digest('hex');assert.equal(JSON.parse(presented.meta).messages_sha256,digest);requestEvidence.push({seq:presented.seq,messages_sha256:digest});
 if(real){
  if(budget.stopped){res.writeHead(429);res.end();return;}
  try{
   const upstream=await fetch(process.env.YUVI_MODEL_BASE_URL.replace(/\/$/,'')+'/chat/completions',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+process.env.YUVI_MODEL_API_KEY},body:JSON.stringify({...body,model:process.env.YUVI_MODEL,max_tokens:Math.min(body.max_tokens??4000,plan.output-budget.output)}),signal:AbortSignal.timeout(600000)});
   if(!upstream.ok){budget.stopped=true;budget.reason='provider_failure';res.writeHead(502);res.end();return;}
   res.writeHead(200,{'content-type':'text/event-stream'});let buffer='',usage;
   for await(const chunk of upstream.body){res.write(chunk);buffer+=Buffer.from(chunk).toString('utf8');let at;while((at=buffer.indexOf('\n\n'))>=0){const block=buffer.slice(0,at);buffer=buffer.slice(at+2);for(const line of block.split('\n'))if(line.startsWith('data: ')&&line.slice(6)!=='[DONE]'){try{const value=JSON.parse(line.slice(6));if(value.usage)usage=value.usage;}catch{}}}}
   budget.add(usage);res.end();
  }catch{budget.stopped=true;budget.reason='provider_failure';res.destroy();}return;
 }
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
 else if(current.type==='probe'&&['A1','A2','E-R','E-SC'].includes(arm))tool_calls=[{index:0,id:'check-life',type:'function',function:{name:arm==='E-R'?'recall':'check',arguments:JSON.stringify(current.query)}}];
 else if(current.type!=='probe'&&++ordinary%25===0)tool_calls=[{index:0,id:'silent-life',type:'function',function:{name:'stay_silent',arguments:'{}'}}];
 else content=['嗯，继续。','听到了。','接着说吧。'][ordinary%3];
 const usage={prompt_tokens:body.messages.reduce((n,m)=>n+m.content.length,0),completion_tokens:content.length};
 res.writeHead(200,{'content-type':'text/event-stream'});
 res.end(frame({choices:[{delta:tool_calls?{tool_calls}:{content}}]})+frame({choices:[{delta:{},finish_reason:tool_calls?'tool_calls':'stop'}],usage})+'data: [DONE]\n\n');
});fake.listen(0,'127.0.0.1');await once(fake,'listening');
mock.timers.enable({apis:['Date','setTimeout','setInterval'],now:start});
const config={recall:arm.startsWith('E-')||['R1','R2'].includes(arm),surfacing:arm==='E-SR'?'recency':['E-S','E-SC','R2'].includes(arm)?'relevance':'off',dataDir:join(out,'data'),persona:'这是隔离的合成生活评测。',ownerName:life.owner_name,model:real?process.env.YUVI_MODEL:'offline-life',apiKey:'fake-offline-only',baseUrl:`http://127.0.0.1:${fake.address().port}/v1`,
 host:'127.0.0.1',port:0,contextEvents:life.config.YUVI_CONTEXT_EVENTS,writingChars:life.config.YUVI_CONTEXT_WRITING_CHARS,consolidationIdleMs:life.config.YUVI_CONSOLIDATION_IDLE_MS,
 consolidationMaxTokens:life.config.YUVI_CONSOLIDATION_MAX_TOKENS,idleTimeoutMs:60000,maxDurationMs:600000};
const app=createApp(config,undefined,{checkEngine:arm==='A1'?'scan':undefined});app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
const wall=performance.now(),url=`http://127.0.0.1:${app.server.address().port}`;
try{
 for(const event of events){
  if(budget?.stopped)break;
  advancing=true;mock.timers.tick(event.t-Date.now());await app.idle();await new Promise(r=>setImmediate(r));advancing=false;current=event;
  if(budget?.stopped)break;
  const response=await fetch(url+'/api/messages',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text:event.text})});
  const stream=await response.text();if(budget?.stopped)break;
  if(!/event: (done|silent)\n/.test(stream))throw Error('Evaluation turn did not complete normally');
  await app.idle();await new Promise(r=>setImmediate(r));
 }
 if(!budget?.stopped){advancing=true;mock.timers.tick(end-Date.now());}await app.idle();await new Promise(r=>setImmediate(r));
 if(budget)writeFileSync(join(out,'budget.json'),JSON.stringify(budget.result(),null,2)+'\n');
 writeFileSync(join(out,'requests.json'),JSON.stringify(requestEvidence,null,2)+'\n');
 writeFileSync(join(out,'run.json'),JSON.stringify({format:1,life:id,arm,days,writing_policy:life.writing_policy,owner_messages:events.length,requests,idle_consolidations:idleConsolidations,pressure_consolidations:pressureConsolidations,simulated_start:start,simulated_end:end},null,2)+'\n');
 writeFileSync(join(out,'timing.json'),JSON.stringify({wall_ms:performance.now()-wall,index_bytes:statSync(join(config.dataDir,'index.sqlite')).size},null,2)+'\n');
}finally{
 mock.timers.reset();app.server.closeAllConnections();await new Promise(r=>app.server.close(r));fake.closeAllConnections();await new Promise(r=>fake.close(r));await app.index.close();app.archive.close();
}
