import { createServer } from 'node:http';
import { mkdirSync,writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { supportsFts } from '../../dist/archive-index.js';
import { listen,startService,text,tool,done } from '../../test/helpers/p6-process.mjs';
import { readEvents } from '../../test/helpers/p7-records.mjs';
const [output]=process.argv.slice(2),root=resolve(output);mkdirSync(root,{recursive:false,mode:0o700});
const fake=createServer(async(req,res)=>{const chunks=[];for await(const c of req)chunks.push(c);const body=JSON.parse(Buffer.concat(chunks).toString('utf8'));res.end(body.messages.some(m=>m.role==='tool')?text('仍能正常回答。')+done():tool('check',{query:'不支持'})+done());});
const base=await listen(fake),data=root+'/data',service=await startService(root,{data,baseUrl:base});
try{
 const frames=await service.post('不支持全文检索时也继续对话');
 const last=readEvents(data).findLast(e=>e.kind==='checked'),verify=spawnSync(process.execPath,['dist/maintenance.js','index','verify'],{env:{...process.env,YUVI_DATA_DIR:data},encoding:'utf8'});
 const result={node:process.version,fts5:supportsFts(),last_frame:frames.at(-1).event,check:last.meta,verification:JSON.parse(verify.stdout),passed:!supportsFts()&&frames.at(-1).event==='done'&&last.meta.engine==='scan'&&last.meta.fallback==='index_unavailable'&&JSON.parse(verify.stdout).status==='unsupported'};
 writeFileSync(root+'/results.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));if(!result.passed)process.exitCode=1;
}finally{await service.stop();await new Promise(r=>fake.close(r));}
