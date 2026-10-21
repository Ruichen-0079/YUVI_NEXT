import { createServer } from 'node:http';
import { once } from 'node:events';
import { spawn, execFileSync } from 'node:child_process';
import { mkdir, writeFile, symlink, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { setTimeout as delay } from 'node:timers/promises';

export const frame = value => `data: ${JSON.stringify(value)}\n\n`;
export const text = content => frame({choices:[{delta:{content}}]});
export const tool = (name,args) => frame({choices:[{delta:{tool_calls:[{index:0,id:'call-p6',function:{name,arguments:JSON.stringify(args)}}]}}]});
export const done = usage => frame({choices:[{delta:{},finish_reason:'stop'}],usage})+'data: [DONE]\n\n';
export async function listen(server) {
  server.listen(0,'127.0.0.1'); await once(server,'listening');return `http://127.0.0.1:${server.address().port}`;
}
export async function legacyCheckout(root, ref='190a272') {
  const dir=join(root,'legacy');await mkdir(dir);
  execFileSync('tar',['-x','-C',dir],{input:execFileSync('git',['archive',ref])});
  await symlink(resolve('node_modules'),join(dir,'node_modules'),'dir');
  execFileSync(process.execPath,[resolve('node_modules/typescript/bin/tsc'),'-p',join(dir,'tsconfig.json')]);
  return dir;
}
export async function startService(root,{ checkout=resolve('.'), data, baseUrl, context=20, writing=16000, hook, idle=2147483647, snapshots }={}) {
  const reserve=createServer(),url=await listen(reserve);await new Promise(r=>reserve.close(r));
  const persona=join(root,'persona.txt');await writeFile(persona,'测试人设原文\n');
  const env={...process.env,YUVI_DATA_DIR:data,YUVI_PERSONA_FILE:persona,YUVI_MODEL_BASE_URL:baseUrl+'/v1',YUVI_MODEL:'fake-p6',YUVI_MODEL_API_KEY:'fake-p6-key-only',
    YUVI_PORT:new URL(url).port,YUVI_HOST:'127.0.0.1',YUVI_OWNER_NAME:'小林',YUVI_CONTEXT_EVENTS:String(context),YUVI_CONTEXT_WRITING_CHARS:String(writing),
    YUVI_CONSOLIDATION_IDLE_MS:String(idle),YUVI_MODEL_IDLE_TIMEOUT_MS:'600000',YUVI_MODEL_MAX_DURATION_MS:'600000',YUVI_SNAPSHOT_INTERVAL_MS:'2147483647',TZ:'Asia/Shanghai'};
  delete env.YUVI_LOCAL_ENV_FILE; delete env.NODE_OPTIONS;
  if(snapshots)env.YUVI_SNAPSHOT_DIR=snapshots;else delete env.YUVI_SNAPSHOT_DIR;
  const start=performance.now();const child=spawn(process.execPath,[...(hook?['--import',hook]:[]),join(checkout,'dist/main.js')],{env,stdio:['ignore','pipe','pipe']});
  let output='',readyAt;
  const ready=new Promise((resolve,reject)=>{
    child.stdout.on('data',d=>{output+=d;if(output.includes('YUVI is ready.')&&readyAt===undefined){readyAt=performance.now();resolve();}});
    child.stderr.on('data',d=>{output+=d;});child.once('exit',code=>{if(readyAt===undefined)reject(Error('Service startup failed: '+code+' '+output));});
  });
  await ready;
  return {child,url,startupMs:readyAt-start,get output(){return output;},
    async stop(signal='SIGTERM') {if(child.exitCode===null&&child.signalCode===null){const exited=once(child,'exit');child.kill(signal);await exited;}},
    async rss() {const status=await readFile('/proc/'+child.pid+'/status','utf8');return Number(/^VmRSS:\s+(\d+)/m.exec(status)[1])*1024;},
    async post(value) {
      const sentAt=performance.now();
      const response=await fetch(url+'/api/messages',{method:'POST',body:JSON.stringify({text:value})});
      let buffer='';const frames=[];
      for await(const chunk of response.body){buffer+=Buffer.from(chunk).toString('utf8');let i;
        while((i=buffer.indexOf('\n\n'))>=0){const block=buffer.slice(0,i);buffer=buffer.slice(i+2);const lines=block.split('\n');
          const kind=lines.find(l=>l.startsWith('event: '))?.slice(7),data=lines.find(l=>l.startsWith('data: '))?.slice(6);
          frames.push({event:kind,data,at:performance.now()});}}
      frames.sentAt=sentAt;return frames;
    }
  };
}
export function normaliseRun(existing, events, frames, requests) {
  const ids=new Map(events.slice(existing).map((e,i)=>[e.id,'NEW-'+i]));
  function norm(value) {
    if(typeof value==='string')return ids.get(value)??value;
    if(Array.isArray(value))return value.map(norm);
    if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,norm(v)]));
    return value;
  }
  return norm({events,frames:frames.map(group=>group.map(({event,data})=>({event,data}))),requests});
}
