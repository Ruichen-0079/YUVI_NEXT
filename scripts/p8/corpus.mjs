import { DatabaseSync } from 'node:sqlite';
import { existsSync,mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { ARCHIVE_SCHEMA } from '../../dist/schema.js';
export const queries = [
 ['年糕',['T1']],['猫叫什么来着',['T1','T2']],['4A87',['T3']],['露川-4A87',['T3']],['4a87',['T3']],
 ['VS Code 主题',['T4']],['vs code',['T4']],['蓝色鞋盒',['T5']],['amber spruce',['T6']],['咖啡馆的名字',['T6']],
 ['喀纳斯',['T7']],['鳗',['T8']],['茶叶偏好',[]],['乌龙',['T9']],['车牌尾号',['T10','T11']],['abc123',['T12']],
 ['🎉',['T13']],['忙完',['T14']],['灯塔',['T15']],['冥王星基地',[]],['年糕',[]],['年糕',['T1']],['糖葫芦',[]],
 ['的 我 是',[]],['我的喀纳斯',['T7']],['',[]],['"年糕" OR NEAR(猫 叫) AND -x:*',['T1']],['',[]],['\ud800年糕',['T1']],['灯塔',['T15']]
].map(([query,expected],i)=>({id:'R'+(i+1),query,expected}));
const forbidden = new Set(queries.map(q=>q.query).join('')+'我的猫叫年糕三岁了更正其实豆包新的门禁码是露川主题我换成备用钥匙在蓝色鞋盒里咖啡馆名字此后今天又去坐一会儿去了一趟晚饭吃鳗鱼最近比较喜欢喝乌龙车牌尾号今天好开心等他忙完再说我想到一个灯塔比喻糖葫芦');
export const alphabet=['的','我','是',...Array.from({length:1800},(_,i)=>String.fromCodePoint(0x4e00+i)).filter(c=>!forbidden.has(c)&&!['的','我','是'].includes(c)).slice(0,1200)];
export function varied(file,{count=50000,seed=67}={}) {
 if(existsSync(file))throw Error('Synthetic corpus already exists');mkdirSync(dirname(file),{recursive:true,mode:0o700});
 let random=seed>>>0;const rand=()=>random=(Math.imul(random,1664525)+1013904223)>>>0;
 const cumulative=[];let harmonic=0;for(let i=0;i<alphabet.length;i++){harmonic+=1/(i+1);cumulative.push(harmonic);}
 const word=()=>{const x=rand()/4294967296*harmonic;let a=0,b=alphabet.length-1;while(a<b){const m=(a+b)>>>1;if(cumulative[m]<x)a=m+1;else b=m;}return alphabet[a];};
 const filler=(length=80)=>'的我是'+Array.from({length},word).join('')+' dw'+(rand()%10000);
 const base=Date.parse('2026-01-01T00:00:00Z'),time=seq=>base+seq*1000;
 const targets={},special=new Map();
 const reserve=(label,fraction,content,kind='heard')=>{
  let seq=Math.max(2,Math.floor(fraction*count));while([...special.keys()].some(s=>Math.abs(s-seq)<3))seq++;
  if(seq>=count-2)throw Error('Corpus position overflow');special.set(seq,{label,content,kind});targets[label]=seq;
 };
 const rows=[['T1',.05,'我的猫叫年糕，三岁了'],['T2',.4,'更正：其实猫叫豆包'],['T3',.1,'新的门禁码是露川-4A87'],['T4',.2,'VS Code 主题我换成了 Solarized','said'],
  ['T5',.3,filler(3000)+'……备用钥匙在蓝色鞋盒里','wrote'],['T6',.02,'amber spruce 是那家咖啡馆的名字'],['T7',.01,'去了一趟喀纳斯'],['T8',.5,'晚饭吃了鳗鱼饭'],['T9',.6,'最近比较喜欢喝乌龙'],
  ['T10',.7,'车牌尾号是3721'],['T11',.9,'更正：车牌尾号是3712'],['T12',.8,'ＡＢＣ１２３ 是新的工号'],['T13',.85,'今天好开心🎉'],['T14',.75,'等他忙完再说','silent'],['T15',.95,'我想到一个灯塔的比喻','wrote']];
 for(const r of rows)reserve(...r);
 for(let i=0;i<300;i++)reserve('coffee'+i,.025+(i+.5)/300*.94,'今天又去咖啡馆坐了一会儿');
 for(let i=0;i<60;i++){const length=10+(i*37)%391;reserve('sweet'+i,.03+(i+.5)/60*.94,'糖葫芦'+filler(length).slice(0,length-3));}
 const db=new DatabaseSync(file);let seq=0,lastHeard=null;
 const id=n=>'10000000-0000-4000-8000-'+n.toString(16).padStart(12,'0');
 try{
  db.exec('PRAGMA journal_mode=OFF; PRAGMA synchronous=OFF;');db.exec(ARCHIVE_SCHEMA);db.exec('BEGIN');
  const insert=db.prepare("INSERT INTO events(seq,id,branch,class,kind,scene,actor,t_recorded,reply_to,content,model,meta) VALUES(?,?,'dev:v2-dev',?,?,'web',?,?,?,?,?,?)");
  const add=(kind,content)=>{seq++;const heard=kind==='heard',wrote=kind==='wrote';
   insert.run(seq,id(seq),heard?'experience':wrote?'inner':'act',kind,heard?'owner':'yuvi',time(seq),['said','silent'].includes(kind)?lastHeard:null,content,heard?null:'synthetic',JSON.stringify(wrote?{material:{from_seq:1,through_seq:Math.max(0,seq-1)},finish_reason:'stop'}:{}));
   if(heard)lastHeard=id(seq);
  };
  while(seq<count){
   const next=special.get(seq+1),after=special.get(seq+2);
   if(next){add(next.kind,next.content);if(next.kind==='heard')add('silent','');}
   else if(after?.kind==='said'||after?.kind==='silent')add('heard',filler());
   else if(after||seq+2>count)add('wrote',filler());
   else {add('heard',filler());add('silent','');}
  }
  db.exec('COMMIT; PRAGMA journal_mode=DELETE;');
  const spec=structuredClone(queries);
  spec[20].from=time(targets.T1)+1;spec[20].to=Infinity;
  spec[21].from=time(targets.T1);spec[21].to=time(targets.T1);
  spec[25].query=filler(500);spec[27].from=time(Math.floor(count*.4));spec[27].to=time(Math.floor(count*.42));
  spec[29].kinds=['wrote'];
  return {count,seed,targets,queries:spec,first:base};
 }finally{db.close();}
}
