// Frozen P9 W fixture: synthetic only. P8's varied shape stays byte-identical.
import {DatabaseSync} from 'node:sqlite';
import {existsSync,mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {ARCHIVE_SCHEMA} from '../../dist/schema.js';
import {alphabet,latin} from '../p8/corpus.mjs';
const targetText='我的猫叫年糕我记得那只猫叫年糕想到一个灯塔的比喻绿色邮筒在街角旧照片放在抽屉旧照片已经扫描了今晚的银杏叶夹在书里今天又看到银杏露川的门牌鲸鱼歌声';
const allowed=alphabet.filter(c=>!targetText.includes(c)||'的我是'.includes(c));
export function writings(file,{count=50000,seed=67}={}){
 if(existsSync(file)||!Number.isSafeInteger(count)||count<50000)throw Error('Invalid or existing P9 corpus');
 mkdirSync(dirname(file),{recursive:true,mode:0o700});let random=seed>>>0;
 const rand=()=>random=(Math.imul(random,1664525)+1013904223)>>>0;
 const filler=n=>Array.from({length:n},()=>allowed[rand()%allowed.length]).join('');
 const specials=new Map(),targets={},base=Date.parse('2026-01-01T00:00:00Z'),time=n=>base+n*1000;
 const reserve=(label,fraction,kind,content,scope={})=>{let seq=Math.floor(count*fraction);while(specials.has(seq))seq++;specials.set(seq,{kind,content,...scope});targets[label]=seq;};
 reserve('HT1',.04,'heard','我的猫叫年糕');reserve('WT1',.05,'wrote','我记得那只猫叫年糕');
 reserve('WT2',.30,'wrote',filler(2989)+'……想到一个灯塔的比喻');
 reserve('WT3',.50,'wrote','绿色邮筒在街角',{scene:'qq'});reserve('WT3b',.52,'wrote','绿色邮筒在街角',{branch:'fork:w'});reserve('HT3',.51,'heard','绿色邮筒',{scene:'qq'});
 reserve('WT4',.60,'wrote','');reserve('WT5',.10,'wrote','旧照片放在抽屉');reserve('WT6',.90,'wrote','旧照片已经扫描了');
 reserve('HT7',.69,'heard','今晚的🌙');reserve('WT7',.70,'wrote','🌙🌙');reserve('WT8',.05,'wrote','银杏叶夹在书里');
 for(let i=0;i<20;i++)reserve('WT8x'+i,.4+i*.55/19,'wrote','今天又看到银杏');
 reserve('WT9',.80,'wrote','露川-4A87 的门牌');reserve('HT10',.85,'heard','鲸鱼歌声');
 const db=new DatabaseSync(file);let dialogue=0,pending=[],lastHeard=null,lastScope={},countWrote=0;
 const id=n=>'90000000-0000-4000-8000-'+n.toString(16).padStart(12,'0');
 try{
  db.exec('PRAGMA journal_mode=OFF;PRAGMA synchronous=OFF;');db.exec(ARCHIVE_SCHEMA);db.exec('BEGIN');
  const insert=db.prepare('INSERT INTO events(seq,id,branch,class,kind,scene,actor,t_recorded,reply_to,content,model,meta)VALUES(?,?,?,?,?,?,?,?,?,?,?,?)');
  for(let seq=1;seq<=count;seq++){
   let e=specials.get(seq);
   if(!e){if(dialogue>=40)e={kind:'wrote',content:filler(400+rand()%801)};else e=lastHeard?{kind:'silent',content:'',...lastScope}:{kind:'heard',content:filler(80)+' '+latin[rand()%latin.length]};}
   const isWriting=e.kind==='wrote',isHeard=e.kind==='heard',scene=e.scene??'web',branch=e.branch??'dev:v2-dev';
   const material=isWriting?{material:{from_seq:pending[0]??Math.max(1,seq-1),through_seq:pending.at(-1)??Math.max(1,seq-1)},finish_reason:'stop'}:{};
   insert.run(seq,id(seq),branch,isWriting?'inner':isHeard?'experience':'act',e.kind,scene,isHeard?'owner':'yuvi',time(seq),e.kind==='silent'?lastHeard:null,e.content,isHeard?null:'synthetic',JSON.stringify(material));
   if(isWriting){countWrote++;dialogue=0;pending=[];}else{dialogue++;pending.push(seq);}
   if(isHeard){lastHeard=id(seq);lastScope={scene,branch};}else if(e.kind==='silent')lastHeard=null;
  }
  db.exec('COMMIT;PRAGMA journal_mode=DELETE;');
  return {count,seed,shape:'writings',targets,writings:countWrote,first:base,queries:[
   ['W1','年糕',['WT1']],['W2','灯塔',['WT2']],['W3','绿色邮筒',[]],['W4','',[]],['W5','旧照片',['WT5']],['W6','🌙',['WT7']],['W7','银杏叶',['WT8']],['W8','4a87',['WT9']],['W9','鲸鱼歌声',[]],['W10','银杏',[]],['W11','我的猫',[]]
  ].map(([id,query,expected])=>({id,query,expected,...(id==='W5'?{from:time(targets.WT5),to:time(targets.WT5)}:{})}))};
 }finally{db.close();}
}
