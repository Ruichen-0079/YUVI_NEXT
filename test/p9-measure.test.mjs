// Hand-authored source/manifest witnesses, independent of the runtime selector.
import {test} from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';import {join} from 'node:path';import {tmpdir} from 'node:os';import {Archive} from '../dist/archive.js';import {measure} from '../eval/measure.mjs';
test('P9 independent accounting: omission order, two new channels, and same-timestamp earlier probe echo',async t=>{
 const root=mkdtempSync(join(tmpdir(),'yuvi-p9-measure-'));t.after(()=>rmSync(root,{recursive:true,force:true}));const epoch=Date.parse('2026-11-02T00:00:00Z');
 const cases=['no_carrier','no_recall','not_candidate','cue_no_terms','cue_common','excluded_window','budget_skip','ranked_out','budget_cut','recall_writing','surfaced_writing','echo'];
 for(const name of cases)await t.test(name,()=>{
  const dir=join(root,name);mkdirSync(dir);const a=new Archive(join(dir,'data')),native=Date.now,arm=['no_recall','budget_cut','recall_writing'].includes(name)?'E-R':'E-S';
  const life={format:1,id:'independent-p9',seed:1,start:new Date(epoch+8*3600000).toISOString(),time_zone:'UTC',days:1,writing_policy:'excerpt',evaluation:{arm,days:1},config:{YUVI_CONSOLIDATION_IDLE_MS:3600000},rhythm:{messages:0,variation:0},gaps:[],filler:{topics:[]},people:[],sanity:[],facts:[{id:'F',versions:[{version:'a',day:1,time:'09:00',text:'target 原始锚点',anchor:'原始锚点'}]}],probes:[{id:'P',day:1,time:'10:00',ask:name==='cue_no_terms'?'🌙':'查找一下',query:{query:'target'},targets:['Fa'],tags:[]}]};
  const add=(hour,input)=>{Date.now=()=>epoch+hour*3600000;return a.append(input);};
  const present=(h,sections,surfacing,step=0)=>add(10,{class:'control',kind:'presented',actor:'system',reply_to:h.id,meta:{rules:'p9',purpose:'dialogue',step,sections,total:{chars:0},...(surfacing?{surfacing}: {})}});
  try{add(9,{class:'experience',kind:'heard',actor:'owner',content:'target 原始锚点'});
   let w=name==='no_carrier'?null:add(9.5,{class:'inner',kind:'wrote',actor:'yuvi',content:'target 原始锚点'+(name==='budget_cut'?'x'.repeat(9000):'')});
   const other=add(9.6,{class:'inner',kind:'wrote',actor:'yuvi',content:'target 其他文字'}),h=add(10,{class:'experience',kind:'heard',actor:'owner',content:life.probes[0].ask});
   const surface={strategy:'relevance',terms:name==='cue_no_terms'?[]:name==='not_candidate'?['other']:['target'],dropped:[],candidates:[],excluded:[]};
   if(['cue_no_terms','cue_common'].includes(name))surface.reason=name.slice(4);
   if(['excluded_window','budget_skip'].includes(name))surface.excluded=[{seq:w.seq,why:name==='excluded_window'?'window':'budget'}];
   present(h,name==='surfaced_writing'?[{name:'surfaced',seqs:[w.seq],messages:1,chars:w.content.length}]:[],arm==='E-S'?surface:undefined);
   if(arm==='E-R'&&name!=='no_recall'){
    const r=add(10,{class:'act',kind:'recalled',actor:'yuvi',reply_to:h.id,meta:{arguments:{query:'target'},rules:'p9',engine:'index',mode:'relevance',terms:['target'],dropped:[],rank_seqs:name==='budget_cut'?[other.seq,w.seq]:[w.seq],result_seqs:[name==='budget_cut'?other.seq:w.seq],total:2}});
    present(h,[{name:'step',messages:2,chars:0,assistant_text:'',results:[{recalled:r.id}]}],undefined,1);
   }
   if(name==='echo'){
    // The probe precedes this writing by seq even though the clock is equal.
    w=add(10,{class:'inner',kind:'wrote',actor:'yuvi',content:'原始锚点\n查找一下'});life.probes.push({id:'P2',day:1,time:'11:00',ask:'再聊一次',query:{query:'target'},targets:['Fa'],tags:[]});const second=add(11,{class:'experience',kind:'heard',actor:'owner',content:'再聊一次'});present(second,[{name:'surfaced',seqs:[w.seq],messages:1,chars:w.content.length}],surface);
   }
   a.close();writeFileSync(join(dir,'life.json'),JSON.stringify(life));const m=measure(dir,{write:false}),row=m.probes[0].answers[0];
   if(['recall_writing','surfaced_writing'].includes(name)){assert.equal(row[name],true);assert.equal(row.presented,true);assert.equal(row.reason,null);}
   else if(name==='echo'){assert.equal(m.surfacing.echo.occurrences,1);assert.equal(m.surfacing.echo.ratio,1);}
   else assert.equal(row.reason,name);
  }finally{Date.now=native;try{a.close();}catch{}}
 });
});
