// Validate the retained million-event measurement fixture without generating it again.
import assert from 'node:assert/strict';
import { readFileSync,writeFileSync } from 'node:fs';
import { join,resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { Archive } from '../../dist/archive.js';
import { ArchiveIndex } from '../../dist/archive-index.js';
import { check } from '../../dist/context.js';
const root=resolve(process.argv[2]),data=join(root,'varied/seed'),measured=JSON.parse(readFileSync(join(root,'results.json'),'utf8')).shapes.varied.queries;
const a=new Archive(data),index=new ArchiveIndex(a.db,data),targets={},results=[];
try{
 const source={T1:'我的猫叫年糕，三岁了',T2:'更正：其实猫叫豆包',T3:'新的门禁码是露川-4A87',T4:'VS Code 主题我换成了 Solarized',T5:'备用钥匙在蓝色鞋盒里',T6:'amber spruce 是那家咖啡馆的名字',T7:'去了一趟喀纳斯',T8:'晚饭吃了鳗鱼饭',T9:'最近比较喜欢喝乌龙',T10:'车牌尾号是3721',T11:'更正：车牌尾号是3712',T12:'ＡＢＣ１２３ 是新的工号',T13:'今天好开心🎉',T14:'等他忙完再说',T15:'我想到一个灯塔的比喻'};
 for(const[id,text]of Object.entries(source)){const rows=a.db.prepare('SELECT seq,t_recorded FROM events WHERE instr(content,?)>0').all(text);assert.equal(rows.length,1,id);targets[id]=rows[0];}
 for(const q of measured){let from=-Infinity,to=Infinity;
  if(q.id==='R21')from=targets.T1.t_recorded+1;
  if(q.id==='R22')from=to=targets.T1.t_recorded;
  if(q.id==='R28'){const count=JSON.parse(readFileSync(join(root,'results.json'),'utf8')).count;from=Date.parse('2026-01-01T00:00:00Z')+Math.floor(count*.4)*1000;to=Date.parse('2026-01-01T00:00:00Z')+Math.floor(count*.42)*1000;}
  const response=q.id==='R17'?await check(a,JSON.stringify({query:q.query}),'负责人',{index}):index.search(q.query,from,to,q.id==='R30'?['wrote']:undefined);
  const meta='meta'in response?response.meta:null,seqs='results'in response?response.results.map(e=>e.seq):meta?.result_seqs;
  let failure;try{
   assert.ok(meta);for(const id of q.expected)assert.ok(seqs.includes(targets[id].seq),q.id+' '+id);
   if(['R13','R20','R21'].includes(q.id))assert.equal(response.total??meta.total,0);
   if(q.id==='R9')assert.equal(meta.rank_seqs[0],targets.T6.seq);
   if(q.id==='R10')assert.equal(a.search(q.query,from,to).total,0,'Formal R10 scan expectation');
   if(q.id==='R17'){assert.equal(meta.engine,'scan');assert.equal(meta.fallback,'no_terms');}
   if(q.id==='R23'){assert.equal(response.total,60);assert.equal(seqs.length,40);}
   if(q.id==='R24')assert.equal(meta.mode,'recent');
   if(q.id==='R26'){assert.ok(meta.terms.length<=32);assert.equal(meta.terms_limited,true);}
   if(q.id==='R30')assert.equal(index.search('年糕',from,to,['wrote']).total,0);
  }catch(e){failure=e.message;}
  results.push({id:q.id,meta,total:response.total??meta?.total,result_seqs:seqs,passed:failure===undefined,...(failure?{failure}:{})});
 }
 const rebuild_checks={};
 for(const shape of ['varied','typical']){const db=new DatabaseSync(join(root,shape,'live/archive.sqlite'),{readOnly:true});try{
  const checks=db.prepare("SELECT seq,meta FROM events WHERE kind='checked' AND seq>? ORDER BY seq").all(JSON.parse(readFileSync(join(root,'results.json'),'utf8')).count).map(e=>({seq:e.seq,...JSON.parse(e.meta)}));
  rebuild_checks[shape]={checks,passed:checks.length===5&&checks.every(c=>c.engine==='scan'&&c.fallback==='index_building')};
 }finally{db.close();}}
 writeFileSync(join(root,'rebuild-check-audit.json'),JSON.stringify(rebuild_checks,null,2)+'\n');
 writeFileSync(join(root,'retrieval-validation.json'),JSON.stringify({node:process.version,targets,results},null,2)+'\n');
 console.log(JSON.stringify({passed:results.filter(r=>r.passed).length,failed:results.filter(r=>!r.passed).map(r=>r.id)}));
 if(results.some(r=>!r.passed))process.exitCode=1;
}finally{await index.close();a.close();}
