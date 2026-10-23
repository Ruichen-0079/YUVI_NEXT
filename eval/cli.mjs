import { spawnSync } from 'node:child_process';
import { existsSync,mkdirSync,mkdtempSync,readFileSync,writeFileSync } from 'node:fs';
import { join,resolve,basename } from 'node:path';
import { performance } from 'node:perf_hooks';
import assert from 'node:assert/strict';
import { loadLife } from './life.mjs';
import { measure } from './measure.mjs';
import { varied } from '../scripts/p8/corpus.mjs';
import { buildIndex,ArchiveIndex } from '../dist/archive-index.js';
import { Archive } from '../dist/archive.js';
const combinations=[['life-a','A0','excerpt'],['life-a','A1','excerpt'],['life-a','A2','excerpt'],['life-a','A0','none'],['life-a','A2','none'],['life-b','A0','excerpt'],['life-b','A1','excerpt'],['life-b','A2','excerpt']];
export function runLife(id,arm,out,days=63,policy){
 const life=loadLife(id);
 const child=spawnSync(process.execPath,[new URL('./run.mjs',import.meta.url).pathname,id,arm,resolve(out),String(days),policy??life.writing_policy],{env:{...process.env,TZ:life.time_zone},encoding:'utf8',maxBuffer:2**20});
 if(child.status!==0)throw Error('Evaluation failed: '+child.stderr);
 return measure(out);
}
export async function retrieval(directory){
 mkdirSync(directory,{recursive:true,mode:0o700});const fixture=varied(join(directory,'archive.sqlite')),a=new Archive(directory);let index;
 try{
  buildIndex(directory);index=new ArchiveIndex(a.db,directory);
  return fixture.queries.map(q=>{
   let indexed;
   if(q.query&&/[\p{L}\p{N}]/u.test(q.query))indexed=index.search(q.query,q.from??-Infinity,q.to??Infinity,q.kinds);
   else if(q.query)indexed={...a.search(q.query,q.from??-Infinity,q.to??Infinity),meta:{engine:'scan',fallback:'no_terms'}};
   else indexed=index.search('',q.from??-Infinity,q.to??Infinity,q.kinds);
   const scanned=a.search(q.query,q.from??-Infinity,q.to??Infinity);
   return{id:q.id,query:q.query,index:{total:indexed.total,result_seqs:indexed.results.map(e=>e.seq),meta:indexed.meta},scan:{total:scanned.total,result_seqs:scanned.results.map(e=>e.seq)},targets:Object.fromEntries(q.expected.map(id=>[id,fixture.targets[id]]))};
  });
 }finally{await index?.close();a.close();}
}
function report(result,root){
 let md='# P8 九周合成生活基线\n\n本报告只证明检索与呈现，不证明模型理解、注意或使用。假模型查询由脚本给定，比真实模型理想；excerpt 只是固定摘抄策略。\n\n';
 md+='| 生活/臂/写作 | 呈现答案 | 检索候选有交集 | 排进前100 | 未解释遗漏 |\n| --- | ---: | ---: | ---: | ---: |\n';
 for(const [key,r]of Object.entries(result.runs))md+=`| ${key} | ${r.coverage.overall.presented}/${r.coverage.overall.total} | ${r.retrieval_gap.overlap} | ${r.retrieval_gap.ranked_100} | ${r.reasons.unexplained} |\n`;
 md+='\n## Q1：旧信息的检索与呈现\n\n';for(const [key,r]of Object.entries(result.runs))md+=`- ${key}（呈现）：`+Object.entries(r.coverage.age).map(([age,v])=>`${age} ${v.presented}/${v.total}`).join('；')+'。\n';
 md+='\n## Q2：新旧材料的竞争\n\n逐版本的排序位置与是否呈现见下表及 JSON 的 corrections。没有按“当前事实”替换旧记录；排序只由词元统计与时间决定。\n';
 md+='\n## Q3：更正前后能否同时呈现\n\n';for(const[key,r]of Object.entries(result.runs))md+=`- ${key}（呈现）：${r.corrections.filter(c=>c.all_presented).length}/${r.corrections.length} 个更正探针呈现全部版本。\n`;
 md+='\n## Q4：高频日常的干扰\n\n相同事实、时间与探针在两段生活中保持不变；下表按臂比较，不把差异解释成语义能力。\n';
 for(const arm of ['A0','A1','A2']){const a=result.runs[`life-a-${arm}-excerpt`],b=result.runs[`life-b-${arm}-excerpt`];md+=`- ${arm}（呈现）：高频标签答案 life-a ${a.coverage.tags.high_frequency.presented}/${a.coverage.tags.high_frequency.total}；life-b ${b.coverage.tags.high_frequency.presented}/${b.coverage.tags.high_frequency.total}。\n`;}
 md+='\n## Q5：候选、前100与实际呈现的损失\n\n检索候选与所有渠道呈现不是严格的漏斗：文字与窗口可能直接呈现；强制最近条也可能排在前100之外。\n\n| 生活/臂 | 全部词相交 | 保留词相交 | 排进前100 | check呈现但不在前100 | 无check主答案仍呈现 | 全渠道呈现 |\n| --- | ---: | ---: | ---: | ---: | ---: | ---: |\n';
 for(const[key,r]of Object.entries(result.runs)){const g=r.retrieval_gap;md+=`| ${key} | ${g.overlap}/${g.total} | ${g.used_overlap} | ${g.ranked_100} | ${g.check_presented_outside_top100} | ${g.presented_without_check} | ${g.presented} |\n`;}
 md+='\n## A2 相对 A1 的逐探针对照\n\n下表只比较检索/呈现事实。rank=无表示不在所记录前100，不能当成没有候选；旧版scan按时间排序。\n\n| 生活 | 探针/答案 | A1 呈现 / rank / 原因 | A2 呈现 / rank / 原因 |\n| --- | --- | --- | --- |\n';
 for(const life of ['life-a','life-b']){const before=result.runs[`${life}-A1-excerpt`],after=result.runs[`${life}-A2-excerpt`];
  for(const p of after.probes)for(const a of p.answers){const old=before.probes.find(v=>v.id===p.id).answers.find(v=>v.target===a.target);const cell=v=>`${v.presented?'是':'否'} / ${v.rank??'无'} / ${v.reason??'已呈现'}`;md+=`| ${life} | ${p.id}/${a.target} | ${cell(old)} | ${cell(a)} |\n`;}}
 md+='\n## 整理、文字呈现与成本\n\n| 生活/臂 | 空闲/压力整理 | 非空文字 | 从未呈现 | 经check呈现 | 请求数 | 第0步字数均值/p95 | 续步字数均值/p95 | 工具结果字数 |\n| --- | ---: | ---: | ---: | ---: | ---: | --- | --- | ---: |\n';
 for(const[key,r]of Object.entries(result.runs)){const c=r.cost;md+=`| ${key} | ${r.consolidation.idle}/${r.consolidation.pressure} | ${r.writings.rows.length} | ${r.writings.never_presented} | ${r.writings.via_check} | ${c.requests} | ${c.zero_chars.mean}/${c.zero_chars.p95} | ${c.later_chars.mean}/${c.later_chars.p95} | ${c.tool_result_chars} |\n`;}
 md+='\n更正探针的呈现顺序（true为所有版本均呈现且按原事件时间顺序；null为不能作此判断）：\n';
 for(const[key,r]of Object.entries(result.runs))md+=`- ${key}：`+r.corrections.map(c=>`${c.probe} ${c.chronological} (${c.presentation_order.join(' → ')||'无'})`).join('；')+'。\n';
 md+='\n## Q6：遗漏复现\n\n';for(const[key,r]of Object.entries(result.runs))md+=`- ${key}：${JSON.stringify(r.reasons)}。\n`;
 md+='\n## 逐探针证据与遗漏命令\n\n| 生活/臂 | 探针 | 答案 | 渠道 | 排名 | 原因 |\n| --- | --- | --- | --- | ---: | --- |\n';
 for(const[key,r]of Object.entries(result.runs))for(const p of r.probes)for(const a of p.answers){const ch=Object.entries({window:a.window,writing:a.writing,check:a.check,check_writing:a.check_writing}).filter(([,v])=>v).map(([k])=>k).join(',')||'无';md+=`| ${key} | ${p.id} | ${a.target} | ${ch} | ${a.rank??'不在前100'} | ${a.reason??'已呈现'} |\n`;}
 md+='\n每次遗漏的复现命令（同一探针的多个答案共用一条命令）：\n\n```sh\n';
 for(const[key,r]of Object.entries(result.runs))for(const p of r.probes)if(p.answers.some(a=>!a.presented))md+=`npm run eval -- explain ${root}/${key} ${p.id}\n`;
 md+='```\n\n## 限制与 WP-E 的问题\n\nP20/R13 的换说法失败按原样保留。假模型不理解整理文字，结果不能说明真实模型如何查询或使用记忆（H7）。原文窗口与文字预算未为这些探针调整。WP-E 应与本基线比较：跨天连续性的改变（H1）、增加浮现后的呈现增益和闯入（H2）、真实模型是否自行查询（H7）；需要另行批准真实模型实验。\n';
 return md;
}
export async function baseline(regress=false){
 mkdirSync('.local-data',{recursive:true,mode:0o700});const root=mkdtempSync(resolve('.local-data/p8-baseline-')),wall=performance.now(),runs={};
 for(const[id,arm,policy]of combinations){const key=`${id}-${arm}-${policy}`;runs[key]=runLife(id,arm,join(root,key),63,policy);assert.equal(runs[key].reasons.unexplained,0);assert.ok(runs[key].sanity.every(s=>s.all_presented));}
 const result={format:1,runs,retrieval:await retrieval(join(root,'retrieval'))};
 const serialized=JSON.stringify(result,null,2)+'\n';writeFileSync(join(root,'baseline.json'),serialized);
 writeFileSync(join(root,'timing.json'),JSON.stringify({wall_ms:performance.now()-wall},null,2)+'\n');
 if(regress)assert.equal(serialized,readFileSync('docs/notes/P8-baseline.json','utf8'),'Full nine-week baseline changed');
 else {writeFileSync('docs/notes/P8-baseline.json',serialized);writeFileSync('docs/notes/P8-baseline.md',report(result,'.local-data/'+basename(root)));}
 return {root,wall_ms:performance.now()-wall};
}
const [command,...args]=process.argv.slice(2);
try{
 if(command==='run'){
  const[id,...rest]=args,opt=Object.fromEntries(Array.from({length:rest.length/2},(_,i)=>[rest[i*2],rest[i*2+1]]));
  const result=runLife(id,opt['--arm'],opt['--out']);console.log(JSON.stringify({coverage:result.coverage.overall,reasons:result.reasons}));
 }else if(command==='measure'&&args.length===1)console.log(JSON.stringify(measure(args[0]),null,2));
 else if(command==='explain'&&args.length===2){const result=measure(args[0],{write:false}),probe=[...result.probes,...result.sanity].find(p=>p.id===args[1]);if(!probe)throw Error('Unknown probe');console.log(JSON.stringify(probe,null,2));}
 else if((command==='baseline'||command==='regress')&&!args.length)console.log(JSON.stringify(await baseline(command==='regress')));
 else throw Error('Invalid evaluation command');
}catch(error){console.error(error.message);process.exitCode=1;}
