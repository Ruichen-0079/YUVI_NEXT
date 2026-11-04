// A legal long-token request exposes the pending C7 specification conflict.
// Actual service + loopback fake only; keep this synthetic directory for review.
import {mkdtempSync} from 'node:fs';import {resolve,join} from 'node:path';import {createServer} from 'node:http';
import {listen,startService,text,done} from '../../test/helpers/p6-process.mjs';import {readEvents} from '../../test/helpers/p7-records.mjs';
const root=mkdtempSync(resolve('.local-data/p9-longword-')),data=join(root,'data');const fake=createServer(async(req,res)=>{for await(const c of req){}res.end(text('正常回应')+done());});const base=await listen(fake);
let service;try{service=await startService(root,{data,baseUrl:base,recall:true,surfacing:'relevance'});const frames=await service.post('a'.repeat(5000)),p=readEvents(data).find(e=>e.kind==='presented');console.log(JSON.stringify({input_chars:5000,turn_result:frames.at(-1).event,term_chars:p.meta.surfacing.terms.map(t=>t.length),manifest_bytes:Buffer.byteLength(JSON.stringify(p.meta)),formal_C7_limit:2500,meets_unconditional_limit:Buffer.byteLength(JSON.stringify(p.meta))<=2500}));}
finally{await service?.stop();fake.closeAllConnections();await new Promise(r=>fake.close(r));}
