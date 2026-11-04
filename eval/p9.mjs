import {readFileSync,writeFileSync,mkdtempSync,mkdirSync} from 'node:fs';
import {resolve,join,basename} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {measure} from './measure.mjs';
import {DatabaseSync} from 'node:sqlite';
const distribution=a=>({mean:a.reduce((n,v)=>n+v,0)/a.length,p95:[...a].sort((a,b)=>a-b)[Math.ceil(a.length*.95)-1]});
function p8Cost(directory){const db=new DatabaseSync(join(directory,'data/archive.sqlite'),{readOnly:true});try{
 const rows=db.prepare("SELECT reply_to,json_extract(meta,'$.total.chars') chars FROM events WHERE kind='presented' AND reply_to IS NOT NULL").all(),turns=new Map();for(const r of rows)turns.set(r.reply_to,(turns.get(r.reply_to)??0)+r.chars);return distribution([...turns.values()]);
}finally{db.close();}}
export async function baselineP9(regress=false,{baseline,runLife}){
 mkdirSync('.local-data',{recursive:true,mode:0o700});const root=mkdtempSync(resolve('.local-data/p9-baseline-')),wall=performance.now();
 // This is an actual fresh P8 regression, not an inferred compatibility claim.
 const p8Run=await baseline(true),p8=JSON.parse(readFileSync('docs/notes/P8-baseline.json','utf8')),runs={};
 for(const life of ['life-a','life-b'])for(const arm of ['E-R','E-S','E-SR','E-SC']){
  const key=`${life}-${arm}-excerpt`,r=runLife(life,arm,join(root,key),63,'excerpt');
  assert.equal(r.reasons.unexplained,0);assert.equal(r.sanity.length,7);assert.ok(r.sanity.every(p=>p.answers.every(a=>a.window)),'Sanity must be presented through the window');
  assert.deepEqual(r.surfacing.duplicates,{foreground:0,window:0});assert.ok(r.p9cost.manifest_bytes.max<=2500);
  const before=p8Cost(join(p8Run.root,`${life}-A0-excerpt`));r.p9cost.vs_p8_a0={baseline:before,mean_delta:r.p9cost.turn_chars.mean-before.mean,p95_delta:r.p9cost.turn_chars.p95-before.p95};runs[key]=r;
 }
 return writeResult(root,p8Run,runs,p8,regress,performance.now()-wall);
}
function writeResult(root,p8Run,runs,p8,regress,elapsedMs){
 const get=(life,arm)=>runs[`${life}-${arm}-excerpt`]??p8.runs[`${life}-${arm}-excerpt`];
 const old=(r,days)=>r.probes.flatMap(p=>p.answers).filter(a=>a.age_days>days),rate=a=>a.length?a.filter(v=>v.presented).length/a.length:0;
 const h1=['life-a','life-b'].map(life=>({life,p8:rate(old(get(life,'A0'),7)),p9:rate(old(get(life,'E-R'),7))}));
 const h2a=['life-a','life-b'].map(life=>({life,p8:get(life,'A0').coverage.overall.rate,p9:get(life,'E-S').coverage.overall.rate}));
 const gains=[];for(const life of ['life-a','life-b']){const before=get(life,'A0');for(const p of get(life,'E-S').probes)for(const a of p.answers){const b=before.probes.find(v=>v.id===p.id).answers.find(v=>v.target===a.target);if(a.presented&&!b.presented)gains.push({life,probe:p.id,target:a.target,age_days:a.age_days});}}
 const h2d=['life-a','life-b'].map(life=>({life,relevance:rate(old(get(life,'E-S'),28)),recency:rate(old(get(life,'E-SR'),28))}));
 const h2e=['life-a','life-b'].map(life=>({life,p8:get(life,'A2').coverage.overall.rate,p9:get(life,'E-SC').coverage.overall.rate}));
 const b=get('life-b','E-S').surfacing;
 const hypotheses={
  'H1-o':{status:h1.every(v=>v.p9<=v.p8)?'refuted':'supported',evidence:h1},
  'H2-a':{status:h2a.every(v=>v.p9<=v.p8)?'refuted':'supported',evidence:h2a},
  'H2-b':{status:!gains.length?'inconclusive':gains.filter(v=>v.age_days>1).length>gains.length/2?'supported':'refuted',evidence:{gains,older_than_1d:gains.filter(v=>v.age_days>1).length,total:gains.length}},
  'H2-c':{status:b.turns.nonprobe.rate>=.1&&b.echo.ratio>0?'supported':'refuted',evidence:{nonprobe_rate:b.turns.nonprobe.rate,echo:b.echo}},
  'H2-d':{status:h2d.every(v=>v.recency>=v.relevance)?'refuted':'supported',evidence:h2d},
  'H2-e':{status:h2e.some(v=>v.p9<v.p8)?'refuted':'supported',evidence:h2e}};
 const result={format:1,evidence:'offline retrieval and presentation only; no evidence of model attention, understanding or use',p8_regression:{passed:true,sha256:createHash('sha256').update(readFileSync('docs/notes/P8-baseline.json')).digest('hex')},runs,hypotheses};
 const serialized=JSON.stringify(result,null,2)+'\n';writeFileSync(join(root,'baseline.json'),serialized);const timing={wall_ms:elapsedMs,p8_regression_wall_ms:p8Run.wall_ms,p8_root:p8Run.root};writeFileSync(join(root,'timing.json'),JSON.stringify(timing,null,2)+'\n');
 assert.ok(timing.wall_ms<=1800000,'P9 baseline exceeds 30 minutes');
 if(regress)assert.equal(serialized,readFileSync('docs/notes/P9-baseline.json','utf8'),'P9 deterministic baseline changed');
 else{writeFileSync('docs/notes/P9-baseline.json',serialized);writeFileSync('docs/notes/P9-baseline.md',report(result,'.local-data/'+basename(root),p8));}
 return{root,...timing};
}
export function refreshP9(root,p8Root){
 const p8Run={root:p8Root,wall_ms:JSON.parse(readFileSync(join(p8Root,'timing.json'),'utf8')).wall_ms},p8=JSON.parse(readFileSync('docs/notes/P8-baseline.json','utf8')),runs={};
 for(const life of ['life-a','life-b'])for(const arm of ['E-R','E-S','E-SR','E-SC']){const key=`${life}-${arm}-excerpt`,r=measure(join(root,key));
  assert.equal(r.reasons.unexplained,0);assert.ok(r.sanity.every(p=>p.answers.every(a=>a.window)));assert.ok(r.p9cost.manifest_bytes.max<=2500);
  const before=p8Cost(join(p8Root,`${life}-A0-excerpt`));r.p9cost.vs_p8_a0={baseline:before,mean_delta:r.p9cost.turn_chars.mean-before.mean,p95_delta:r.p9cost.turn_chars.p95-before.p95};runs[key]=r;
 }
 return writeResult(root,p8Run,runs,p8,false,JSON.parse(readFileSync(join(root,'timing.json'),'utf8')).wall_ms);
}

function report(result,root,p8){
 let md='# P9 九周合成生活基线\n\n只报告检索与呈现。假模型由脚本决定工具调用，excerpt 是固定摘抄；不能证明模型注意、理解、采用旧文字，也不能说明真实模型会调用 recall 或其文字会携带答案。冻结生活与 P8 相同；P8 regress 已实际执行且逐字节通过。\n\n';
 md+='## 假设\n\n';for(const[id,h]of Object.entries(result.hypotheses))md+=`- ${id}：**${h.status}**；呈现层证据：${JSON.stringify(h.evidence)}。\n`;
 md+='\n## 逐探针、渠道、排名、遗漏\n\n| 生活/臂 | 探针/答案 | P8 A0/A2 | P9 呈现渠道 | rank | 原因 |\n| --- | --- | --- | --- | ---: | --- |\n';
 for(const[key,r]of Object.entries(result.runs))for(const p of r.probes)for(const a of p.answers){const baseline=arm=>p8.runs[`${r.life}-${arm}-excerpt`].probes.find(v=>v.id===p.id).answers.find(v=>v.target===a.target).presented;md+=`| ${key} | ${p.id}/${a.target} | ${baseline('A0')}/${baseline('A2')} | ${['window','writing','check','check_writing','recall_writing','surfaced_writing'].filter(k=>a[k]).join(',')||'无'} | ${a.rank??'无'} | ${a.reason??'已呈现'} |\n`;}
 md+='\n## 浮现与回想统计\n\n下面各生活采用同一口径，完整逐次候选、排除、携带者及更正版本见配套 JSON。候选不等于最终呈现，返回也不等于使用。\n';
 for(const[key,r]of Object.entries(result.runs))md+=`\n### ${key}\n\n- 浮现：${JSON.stringify(r.surfacing)}\n- recall：${JSON.stringify(r.recall)}\n- 成本：${JSON.stringify(r.p9cost)}\n- 更正：${JSON.stringify(r.corrections)}\n- 遗漏：${JSON.stringify(r.reasons)}\n`;
 md+='\n## 遗漏复现\n\n```sh\n';for(const[key,r]of Object.entries(result.runs))for(const p of r.probes)if(p.answers.some(a=>!a.presented))md+=`npm run eval -- explain ${root}/${key} ${p.id}\n`;
 md+='```\n\n## 限制与 P9-R\n\n没有真实模型调用或费用授权，P9-R 未执行。life-r 与预算护栏仅由离线假模型验证。后续获授权后检验 H7 的自发工具调用率、H1-r 的答案携带率、H2-r 的回答提及与闯入代理；不得将本报告的检索/呈现结果代替这些真实模型结论。浮现保持默认关闭。\n';return md;
}
