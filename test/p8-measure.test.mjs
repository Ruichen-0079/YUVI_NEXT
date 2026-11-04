import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,mkdirSync,writeFileSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Archive } from '../dist/archive.js';
import { measure } from '../eval/measure.mjs';

// Hand-authored accounting fixtures, not output from the evaluation runner.
// These deliberately isolate the ordered predicates in P8 §4.7.
test('P8 independent accounting: all omission predicates, request references and whole-writing channels',async t=>{
 const root=mkdtempSync(join(tmpdir(),'yuvi-p8-accounting-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
 const epoch=Date.parse('2026-11-02T00:00:00Z');
 const cases=[
  ['no_check',null,{query:'target'}],
  ['outside_range',{engine:'index',terms:['target']},{query:'target',from:'2026-11-03'}],
  ['substring_miss',{engine:'scan'},{query:'other'}],
  ['recency_cut',{engine:'scan',selected:'new'},{query:'target'}],
  ['no_overlap',{engine:'index',terms:['other']},{query:'other'}],
  ['dropped_only',{engine:'index',terms:['other'],dropped:['target']},{query:'target other'}],
  ['common_mode',{engine:'index',mode:'recent',terms:['target'],selected:'new'},{query:'target'}],
  ['budget_cut',{engine:'index',terms:['target'],selected:'two',ranking:'budget'},{query:'target'}],
  ['ranked_out',{engine:'index',terms:['target'],selected:'new',ranking:'none'},{query:'target'}],
  ['unexplained',{engine:'index',mode:'recent',terms:['target'],selected:'old'},{query:'target'}],
  ['presented_check',{engine:'index',terms:['target'],selected:'answer'},{query:'target'}],
  ['not_referenced',{engine:'index',terms:['target'],selected:'answer',referenced:false},{query:'target'}],
  ['writing',null,{query:'target'}],
  ['check_writing',{engine:'index',terms:['target'],selected:'writing'},{query:'target'}]
 ];
 for(const [name,selection,query]of cases)await t.test(name,()=>{
  const dir=join(root,name);mkdirSync(dir);const a=new Archive(join(dir,'data')),native=Date.now;
  const add=(hour,row)=>{Date.now=()=>epoch+hour*3600000;return a.append(row);};
  const life={format:1,id:'accounting-fixture',seed:1,start:new Date(epoch+8*3600000).toISOString(),time_zone:'UTC',days:1,writing_policy:'excerpt',evaluation:{arm:selection?'A2':'A0',days:1},
   config:{YUVI_CONSOLIDATION_IDLE_MS:3600000},rhythm:{messages:0,variation:0},gaps:[],filler:{topics:[]},people:[],sanity:[],
   facts:[{id:'F',versions:[{version:'a',day:1,time:'09:00',text:'target 原始锚点',anchor:'原始锚点'}]}],
   probes:[{id:'P',day:1,time:'10:00',ask:'查找一下',query,targets:['Fa'],tags:[]}]};
  try{
   const best=add(8,{class:'experience',kind:'heard',actor:'owner',content:'target '+'x'.repeat(16000)});
   const answer=add(9,{class:'experience',kind:'heard',actor:'owner',content:life.facts[0].versions[0].text});
   const newest=add(9.5,{class:'experience',kind:'heard',actor:'owner',content:'target 新材料'});
   const writing=add(9.6,{class:'inner',kind:'wrote',actor:'yuvi',content:'摘录原始锚点'});
   const heard=add(10,{class:'experience',kind:'heard',actor:'owner',content:'查找一下'});
   const baseSections=name==='writing'?[{name:'writings',first_seq:writing.seq,last_seq:writing.seq,count:1,messages:1,chars:writing.content.length}]:[];
   const manifest={purpose:'dialogue',step:0,sections:baseSections,total:{chars:0}};
   add(10,{class:'control',kind:'presented',actor:'system',reply_to:heard.id,meta:manifest});
   if(selection){
    const selected=selection.selected==='old'?[best.seq]:selection.selected==='new'?[newest.seq]:selection.selected==='answer'?[answer.seq]:selection.selected==='writing'?[writing.seq]:selection.selected==='two'?[best.seq,newest.seq]:[];
    const checked=add(10,{class:'act',kind:'checked',actor:'yuvi',reply_to:heard.id,meta:{arguments:query,rules:'p8',engine:selection.engine,mode:selection.mode??'relevance',terms:selection.terms??[],dropped:selection.dropped??[],total:3,result_seqs:selected,rank_seqs:selection.ranking==='budget'?[best.seq,answer.seq,newest.seq]:selection.ranking==='none'?[]:[answer.seq]}});
    if(selection.referenced!==false)add(10,{class:'control',kind:'presented',actor:'system',reply_to:heard.id,meta:{purpose:'dialogue',step:1,total:{chars:0},sections:[...baseSections,{name:'step',index:0,messages:2,chars:0,assistant_text:'',results:[{checked:checked.id}]}]}});
   }
   a.close();writeFileSync(join(dir,'life.json'),JSON.stringify(life));const result=measure(dir,{write:false}),row=result.probes[0].answers[0];
   if(['presented_check','writing','check_writing'].includes(name)){assert.equal(row.presented,true);assert.equal(row.reason,null);}
   else if(name==='not_referenced'){assert.equal(row.presented,false);assert.equal(row.check,false);assert.equal(row.reason,'ranked_out');}
   else{assert.equal(row.presented,false);assert.equal(row.reason,name);}
   if(name==='writing')assert.equal(row.writing,true);
   if(name==='check_writing'){assert.equal(row.check_writing,true);assert.equal(row.check,false);assert.equal(result.writings.via_check,1);}
  }finally{Date.now=native;try{a.close();}catch{/* already closed */}}
 });
});
