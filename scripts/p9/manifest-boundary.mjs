// Actual service + loopback fake, independent P8 Latin tokenization oracle.
// Retain standalone synthetic artifacts; unit-test callers own fixture cleanup.
import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';import {resolve,join} from 'node:path';import {createServer} from 'node:http';
import {listen,startService,text,done} from '../../test/helpers/p6-process.mjs';
import {readEvents,capturePresentation,assertPresentations,structuralBytes} from '../../test/helpers/p7-records.mjs';
export const longInputs=[['one-long-word','a'.repeat(5000)],['33-long-words',Array.from({length:33},(_,i)=>String.fromCharCode(97+i%26)+String.fromCharCode(97+Math.floor(i/26))+'b'.repeat(2998)).join(' ')]];
export async function boundary(root,name,input){
 const data=join(root,name),captured=[];const fake=createServer(async(req,res)=>{const chunks=[];for await(const c of req)chunks.push(c);captured.push(capturePresentation(data,JSON.parse(Buffer.concat(chunks).toString())));res.end(text('正常回应')+done());});const base=await listen(fake);
 let service;try{
  service=await startService(root,{data,baseUrl:base,recall:true,surfacing:'relevance'});
  const frames=await service.post(input);assert.equal(frames.at(-1).event,'done');
  const events=assertPresentations(data,captured,'测试人设原文\n'),p=events.find(e=>e.kind==='presented');
  // These inputs contain only distinct Latin words: NFKC/lowercase, unique, first 32;
  // the empty prior index has DF=0 for each word, hence no frequency clipping.
  const expected=[...new Set(input.normalize('NFKC').toLowerCase().match(/[a-z]+/g))].slice(0,32);
  assert.deepEqual(p.meta.surfacing.terms,expected);assert.deepEqual(p.meta.surfacing.dropped,[]);
  assert.equal(p.meta.surfacing.reason,'no_candidates');
  assert.equal(events.find(e=>e.kind==='heard').content,input);assert.equal(events.filter(e=>e.kind==='error').length,0);
  const structural=structuralBytes(p.meta);assert.ok(structural<=2500);
  return {name,input_chars:input.length,turn_result:frames.at(-1).event,term_chars:p.meta.surfacing.terms.map(t=>t.length),dropped:p.meta.surfacing.dropped,reason:p.meta.surfacing.reason,manifest_bytes:Buffer.byteLength(JSON.stringify(p.meta)),structural_bytes:structural,reconstruction:'exact'};
 }finally{await service?.stop();fake.closeAllConnections();await new Promise(r=>fake.close(r));}
}
if(process.argv[1]&&resolve(process.argv[1])===new URL(import.meta.url).pathname){const root=mkdtempSync(resolve('.local-data/p9-longword-'));for(const[name,input]of longInputs)console.log(JSON.stringify({root,...await boundary(root,name,input)}));}
