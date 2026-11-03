import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,readFileSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { measure } from '../eval/measure.mjs';

test('P8 E2/E3/E5/E7: first14d A0/A2 twice, real idle/pressure consolidation, independent deterministic metrics',()=>{
 const root=mkdtempSync(join(tmpdir(),'yuvi-p8-eval-')),wall=performance.now();
 try{
  for(const arm of ['A0','A2']){
   let expected;
   for(let i=0;i<2;i++){
    const out=join(root,arm+'-'+i),run=spawnSync(process.execPath,['eval/run.mjs','life-a',arm,out,'14','excerpt'],{env:{...process.env,TZ:'Asia/Shanghai'},encoding:'utf8',timeout:80000});
    assert.equal(run.status,0,run.stderr);const m=measure(out);
    assert.ok(m.sanity.every(p=>p.all_presented));assert.equal(m.sanity.length,2);assert.equal(m.reasons.unexplained,0);
    assert.ok(m.consolidation.idle>0);assert.ok(m.consolidation.pressure>0);assert.ok(m.consolidation.wrote>0);
    const driver=JSON.parse(readFileSync(join(out,'run.json'),'utf8'));assert.equal(m.consolidation.idle,driver.idle_consolidations);assert.equal(m.consolidation.pressure,driver.pressure_consolidations);
    const bytes=readFileSync(join(out,'metrics.json'),'utf8');if(expected)assert.equal(bytes,expected);else expected=bytes;
   }
  }
  assert.ok(performance.now()-wall<90000,'The four-run fast regression exceeds 90 seconds');
 }finally{rmSync(root,{recursive:true,force:true});}
});

test('P8 E1: both complete 63-day schedules retain frozen messages and have unique excerpt-compatible anchors',async()=>{
 const {loadLife,expand}=await import('../eval/life.mjs');
 const expected={F1a:'我家猫叫团子',F1b:'其实叫年糕',F2:'门禁码是 4A87',F3:'咖啡馆叫 amber spruce',F4:'想去喀纳斯看看',F5a:'尾号是 3721',F5b:'尾号是 3712',F6:'对芒果过敏',F7:'主题换成了 Solarized',F8:'放在蓝色鞋盒里',F9:'生日是三月九号',F10:'喜欢喝乌龙',F11a:'代号叫青鸟',F11b:'现在叫白鹭',F11c:'定名为夜航',F12:'好开心🎉',M1:'见了王老师',M2a:'小周今天请我吃饭',M2b:'小周搬家了',M2c:'小周换了工作',M2d:'小周下个月结婚',M3:'工位在七楼东侧'};
 for(const id of ['life-a','life-b']){
  const life=loadLife(id),old=JSON.parse(spawnSync('git',['show',`dccd0bf:eval/lives/${id}.json`],{encoding:'utf8'}).stdout);
  const stripped=l=>({...l,facts:l.facts.map(e=>({...e,versions:e.versions.map(({anchor,tail,...v})=>v)})),people:l.people.map(e=>({...e,mentions:e.mentions.map(({anchor,...v})=>v)}))});
  assert.deepEqual(stripped(life),stripped(old));
  const {events,answers}=expand(life);assert.deepEqual(expand(life).events,events);assert.equal(Object.keys(answers).length,29);
  for(const [key,anchor]of Object.entries(expected))assert.equal(answers[key].anchor,anchor);
  assert.equal(answers.F8.tail,true);assert.equal(answers.F8.text.length,1500);
  const ordinary=events.filter(e=>e.type==='ordinary');
  for(const a of Object.values(answers))assert.equal(ordinary.some(e=>e.text.includes(a.anchor)),false);
  for(const p of life.probes)assert.equal(events.filter(e=>e.type==='probe'&&e.probe===p.id).length,1);
  for(const g of life.gaps)assert.equal(events.some(e=>{const d=Math.floor((e.t-(Date.parse(life.start)-8*3600000))/86400000)+1;return d>=g.from_day&&d<g.from_day+g.days;}),false);
 }
});
