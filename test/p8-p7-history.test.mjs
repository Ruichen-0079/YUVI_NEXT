import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { legacyCheckout,startService,listen,text,tool,done } from './helpers/p6-process.mjs';
import { readEvents,cliPresented,capturePresentation } from './helpers/p7-records.mjs';

test('P8 C2/C4: genuine P7 requests remain exact after P8 appends indexed checks',async t=>{
 const root=mkdtempSync(join(tmpdir(),'yuvi-p8-p7-')),old=await legacyCheckout(root,'3343efa');t.after(()=>rmSync(root,{recursive:true,force:true}));
 const data=join(root,'data');let label='p7',captured=[];
 const fake=createServer(async(req,res)=>{const chunks=[];for await(const c of req)chunks.push(c);const body=JSON.parse(Buffer.concat(chunks).toString('utf8'));captured.push({label,...capturePresentation(data,body)});
 res.end(body.messages.some(m=>m.role==='tool')?text('保留原句')+done({prompt_tokens:3}):tool('check',{query:'历史'})+done({prompt_tokens:2}));});
 const base=await listen(fake);t.after(()=>new Promise(r=>fake.close(r)));
 let s=await startService(root,{checkout:old,data,baseUrl:base});try{await s.post('历史原话');await s.post('核对历史');}finally{await s.stop();}
 const before=readEvents(data),db=new DatabaseSync(join(data,'archive.sqlite'),{readOnly:true});let schema;try{schema=db.prepare('SELECT * FROM sqlite_master ORDER BY name').all();}finally{db.close();}
 assert.ok(before.filter(e=>e.kind==='presented').every(e=>e.meta.rules==='p7'));label='p8';s=await startService(root,{data,baseUrl:base});
 try{await s.post('继续核对历史');}finally{await s.stop();}
 assert.deepEqual(readEvents(data).slice(0,before.length),before);
 for(const p of captured){const show=cliPresented(data,join(root,'persona.txt'),['show',String(p.seq),'--messages']);assert.equal(show.reconstruction.status,'exact');assert.deepEqual(show.messages,p.body.messages);assert.equal(show.manifest.rules,p.label);}
 const after=new DatabaseSync(join(data,'archive.sqlite'),{readOnly:true});try{assert.deepEqual(after.prepare('SELECT * FROM sqlite_master ORDER BY name').all(),schema);}finally{after.close();}
});
