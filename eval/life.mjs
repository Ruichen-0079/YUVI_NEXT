import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const ordinary=['的','我','是','天气','散步','晚饭','通勤','窗外','雨声','阳光','书页','风声','小路','公交','树叶','天空','杯子','日常','休息','房间','午后','早晨','夜色'];
export function loadLife(id){if(!['life-a','life-b'].includes(id))throw Error('Unknown synthetic life');return JSON.parse(readFileSync(new URL(`./lives/${id}.json`,import.meta.url),'utf8'));}
export function expand(life,days=life.days){
 let random=life.seed>>>0;const rand=()=>((random=(Math.imul(random,1664525)+1013904223)>>>0)/4294967296);
 const harmonic=ordinary.reduce((n,_,i)=>n+1/(i+1),0);
 const zipf=()=>{let x=rand()*harmonic;for(let i=0;i<ordinary.length;i++){x-=1/(i+1);if(x<=0)return ordinary[i];}return ordinary.at(-1);};
 const filler=(n=30)=>Array.from({length:n},zipf).join('')+'。';
 const start=Date.parse(life.start),midnight=start-8*3600000,at=(day,time)=>midnight+(day-1)*86400000+Number(time.slice(0,2))*3600000+Number(time.slice(3))*60000;
 const inGap=d=>life.gaps.some(g=>d>=g.from_day&&d<g.from_day+g.days);
 const events=[],answers={};
 for(const entity of [...life.facts,...life.people])for(const v of entity.versions??entity.mentions){
  const id=entity.id+v.version,tail='最后提一句，备用钥匙放在蓝色鞋盒里。',text=v.text??filler(1000).slice(0,v.generated_length-tail.length)+tail;
  answers[id]={...v,id,text,t:at(v.day,v.time)};
  if(v.day<=days){assert.ok(!inGap(v.day));events.push({t:at(v.day,v.time),text,type:'fact',target:id});}
 }
 for(const p of life.probes)if(p.day<=days){assert.ok(!inGap(p.day));events.push({t:at(p.day,p.time),text:p.ask,type:'probe',probe:p.id,...p});}
 for(const s of life.sanity)if(s.day<=days){
  assert.ok(!inGap(s.day));answers[s.id]={...s,id:s.id,t:at(s.day,s.time)};
  events.push({t:at(s.day,s.time),text:s.text,type:'fact',target:s.id});
  events.push({t:at(s.day,s.ask_time),text:s.ask,type:'probe',probe:s.id,query:s.query,targets:[s.id],tags:['sanity'],day:s.day});
 }
 for(let day=1;day<=days;day++){
  if(inGap(day))continue;
  const count=life.rhythm.messages+Math.floor((rand()*2-1)*life.rhythm.variation);
  for(let i=0;i<count;i++){
   const minute=Math.floor(8*60+(i+.2+rand()*.6)*15*60/count),time=String(Math.floor(minute/60)).padStart(2,'0')+':'+String(minute%60).padStart(2,'0');
   if(life.sanity.some(s=>s.day===day&&time>='14:59'&&time<='15:02'))continue;
   const topic=life.filler.topics.filter(p=>day>=p.from_day&&day<=p.to_day&&(day-1)%(p.every_days??1)===0&&i<p.per_day).flatMap(p=>p.words);
   const text=filler(8+Math.floor(rand()*16))+(topic.length?topic[i%topic.length]+'。':'');
   events.push({t:at(day,time),text,type:'ordinary',day});
  }
 }
 events.sort((a,b)=>a.t-b.t||a.text.localeCompare(b.text,'en'));
 const anchors=Object.values(answers).filter(a=>a.day<=days);
 for(const a of anchors){
  const occurrences=events.filter(e=>e.text.includes(a.anchor));
  assert.equal(occurrences.length,1,`Anchor ${a.id} must identify exactly one message: ${a.anchor}`);
  assert.equal(occurrences[0].type,'fact');
 }
 return {events,answers,end:midnight+days*86400000,start};
}
