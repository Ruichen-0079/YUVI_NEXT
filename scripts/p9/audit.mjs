// Independent chronological FTS reconstruction for offline life archives.
// No service index reads or writes; original archive opened read-only.
import {DatabaseSync} from 'node:sqlite';import {readFileSync,writeFileSync} from 'node:fs';import {join,resolve} from 'node:path';import assert from 'node:assert/strict';import {performance} from 'node:perf_hooks';
import {presentedShow} from '../../dist/presented.js';
const cj='[\\p{Script=Han}\\p{Script=Hiragana}\\p{Script=Katakana}\\p{Script=Hangul}]',groups=new RegExp(`${cj}+|(?:(?!${cj})[\\p{L}\\p{N}\\p{M}])+`,'gu'),isCjk=new RegExp('^'+cj,'u');
function lex(text,query=false){const out=[];for(const g of text.normalize('NFKC').toLowerCase().match(groups)??[]){if(!isCjk.test(g)){out.push(g);continue;}const c=[...g];if(!query||c.length===1)out.push(...c);for(let i=1;i<c.length;i++)out.push(c[i-1]+c[i]);}return query?[...new Set(out)]:out;}
const quoted=terms=>terms.map(t=>'"'+t.replaceAll('"','""')+'"').join(' OR '),scope=e=>e.scene==='web'&&e.branch==='dev:v2-dev';
export function audit(directory,{replay=true}={}){
 const at=performance.now(),source=new DatabaseSync(join(directory,'data/archive.sqlite'),{readOnly:true}),index=new DatabaseSync(':memory:');
 try{
  const events=source.prepare('SELECT * FROM events ORDER BY seq').all().map(e=>({...e,meta:JSON.parse(e.meta)})),byId=new Map(events.map(e=>[e.id,e])),bySeq=new Map(events.map(e=>[e.seq,e]));
  index.exec("CREATE TABLE docs(seq INTEGER PRIMARY KEY,kind TEXT);CREATE VIRTUAL TABLE terms USING fts5(words,content='',contentless_delete=1,tokenize='ascii');CREATE VIRTUAL TABLE vocab USING fts5vocab(terms,'row');");
  const insert=index.prepare('INSERT INTO docs VALUES(?,?)'),add=index.prepare('INSERT INTO terms(rowid,words)VALUES(?,?)');let surfaced=0,presented=0,reconstructed=0;
  for(const e of events){if(!scope(e))continue;
   if(e.kind==='heard'||e.class==='act'&&['said','silent'].includes(e.kind)||e.class==='inner'&&e.kind==='wrote'&&e.content){insert.run(e.seq,e.kind);add.run(e.seq,lex(e.content).join(' '));}
   if(e.kind!=='presented')continue;presented++;
   if(replay){const show=presentedShow(source,e.seq,'这是隔离的合成生活评测。',true);assert.equal(show.reconstruction.status,'exact',String(e.seq));reconstructed++;}
   if(e.meta.step!==0||!e.meta.surfacing)continue;surfaced++;
   const heard=byId.get(e.reply_to),m=e.meta.surfacing,words=lex(heard.content,true).slice(0,32),freq=words.map((term,i)=>({term,i,n:Number(index.prepare('SELECT doc FROM vocab WHERE term=?').get(term)?.doc??0)})).sort((a,b)=>a.n-b.n||a.i-b.i);
   let used=[],dropped=[],sum=0;for(const f of freq){if(!used.length||sum+f.n<=50000){used.push(f);sum+=f.n;}else dropped.push(f.term);}
   const common=!!used.length&&used[0].n>50000;if(common){dropped=[...used.slice(1).map(f=>f.term),...dropped];used=used.slice(0,1);}
   if(!words.length){assert.equal(m.reason,'no_terms');assert.deepEqual(m.candidates,[]);continue;}
   assert.deepEqual(m.terms,used.map(f=>f.term));assert.deepEqual(m.dropped,dropped);
   if(common){assert.equal(m.reason,'common');continue;}
   const candidates=index.prepare(`SELECT f.rowid FROM terms f JOIN docs d ON d.seq=f.rowid WHERE terms MATCH ? AND d.kind='wrote' AND f.rowid<? ORDER BY ${m.strategy==='relevance'?'f.rank,':''}f.rowid DESC LIMIT20`.replace('LIMIT20','LIMIT 20')).all(quoted(m.terms),heard.seq).map(r=>r.rowid);
   assert.deepEqual(m.candidates,candidates);const fg=e.meta.sections.find(s=>s.name==='writings'),window=e.meta.sections.find(s=>s.name==='window'),selected=[],excluded=[];let chars=0;
   for(const n of candidates){const w=bySeq.get(n),material=w.meta.material;const why=fg&&fg.first_seq<=n&&n<=fg.last_seq?'foreground':window&&material&&material.from_seq<=material.through_seq&&window.first_seq<=material.from_seq&&material.through_seq<=window.last_seq?'window':chars+w.content.length>2000?'budget':null;
    if(why)excluded.push({seq:n,why});else{selected.push(n);chars+=w.content.length;if(selected.length===3)break;}}
   assert.deepEqual(m.excluded,excluded);assert.deepEqual(e.meta.sections.find(s=>s.name==='surfaced')?.seqs??[],selected.sort((a,b)=>a-b));
   if(!selected.length)assert.equal(m.reason,candidates.length?'all_excluded':'no_candidates');else assert.equal(m.reason,undefined);
  }
  let requests=null;try{requests=JSON.parse(readFileSync(join(directory,'requests.json'),'utf8'));}catch{}
  if(requests){assert.equal(requests.length,presented);for(const r of requests)assert.equal(bySeq.get(r.seq).meta.messages_sha256,r.messages_sha256);}
  const result={presented,reconstructed,surfacing_checked:surfaced,actual_request_digests:requests?.length??null,wall_ms:performance.now()-at};writeFileSync(join(directory,'audit.json'),JSON.stringify(result,null,2)+'\n');return result;
 }finally{source.close();index.close();}
}
if(process.argv[1]&&resolve(process.argv[1])===new URL(import.meta.url).pathname)console.log(JSON.stringify(audit(resolve(process.argv[2]),{replay:!process.argv.includes('--selection-only')})));
