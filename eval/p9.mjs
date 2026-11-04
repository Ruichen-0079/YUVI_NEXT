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
function verifiedP8(root){
 root=resolve(root);assert.equal(readFileSync(join(root,'baseline.json'),'utf8'),readFileSync('docs/notes/P8-baseline.json','utf8'),'P8 regression evidence does not match the frozen baseline');
 return {root,wall_ms:JSON.parse(readFileSync(join(root,'timing.json'),'utf8')).wall_ms};
}
export async function baselineP9(regress=false,{baseline,runLife,p8Directory}){
 mkdirSync('.local-data',{recursive:true,mode:0o700});const root=mkdtempSync(resolve('.local-data/p9-baseline-')),wall=performance.now();
 // This is an actual fresh P8 regression, not an inferred compatibility claim.
 const p8Run=p8Directory?verifiedP8(p8Directory):await baseline(true),p8=JSON.parse(readFileSync('docs/notes/P8-baseline.json','utf8')),runs={};
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

// Remeasure retained source archives after an accounting fix; no simulation,
// selection, model calls or source archive writes take place here.
export function refreshP9(root,p8Directory){
 const p8Run=verifiedP8(p8Directory),p8=JSON.parse(readFileSync('docs/notes/P8-baseline.json','utf8')),runs={};
 for(const life of ['life-a','life-b'])for(const arm of ['E-R','E-S','E-SR','E-SC']){const key=`${life}-${arm}-excerpt`,r=measure(join(root,key));
  assert.equal(r.reasons.unexplained,0);assert.ok(r.sanity.every(p=>p.answers.every(a=>a.window)));assert.ok(r.p9cost.manifest_bytes.max<=2500);
  const before=p8Cost(join(p8Run.root,`${life}-A0-excerpt`));r.p9cost.vs_p8_a0={baseline:before,mean_delta:r.p9cost.turn_chars.mean-before.mean,p95_delta:r.p9cost.turn_chars.p95-before.p95};runs[key]=r;
 }
 return writeResult(root,p8Run,runs,p8,false,JSON.parse(readFileSync(join(root,'timing.json'),'utf8')).wall_ms);
}

function report(result,root,p8){
 const run=(life,arm)=>result.runs[`${life}-${arm}-excerpt`],pct=n=>(n*100).toFixed(2)+'%',fmt=n=>Number(n).toFixed(2),cell=v=>JSON.stringify(v);
 let md='# P9 九周合成生活基线\n\n只报告检索与呈现。假模型由脚本决定工具调用，excerpt 是固定摘抄；不能证明模型注意、理解、采用旧文字，也不能说明真实模型会调用 recall 或其文字会携带答案。两段生活与 P8 字节相同，P8 regress 已实际逐字节通过。\n\n';
 md+='## 答案呈现与代价\n\n| 臂 | life-a | life-b | 机制 |\n| --- | ---: | ---: | --- |\n';
 for(const arm of ['A0','A2','E-R','E-S','E-SR','E-SC']){const a=result.runs[`life-a-${arm}-excerpt`]??p8.runs[`life-a-${arm}-excerpt`],b=result.runs[`life-b-${arm}-excerpt`]??p8.runs[`life-b-${arm}-excerpt`];md+=`| ${arm} | ${a.coverage.overall.presented}/${a.coverage.overall.total} | ${b.coverage.overall.presented}/${b.coverage.overall.total} | ${{A0:'无工具',A2:'check','E-R':'recall','E-S':'相关度浮现','E-SR':'新近浮现','E-SC':'相关度浮现 + check'}[arm]} |\n`;}
 md+='\n相对无工具基线的增益不能解释成理解或更可靠的事实记忆。单独 recall 与浮现仍有遗漏，不能取代 check；F8 的长文尾部没有摘抄携带者，换说法也仍可能失败。高频生活中的呈现明显更困难。\n';
 md+=`\n相关度浮现在非探针回合的发生率是 life-a ${pct(run('life-a','E-S').surfacing.turns.nonprobe.rate)}、life-b ${pct(run('life-b','E-S').surfacing.turns.nonprobe.rate)}。这是大量额外内容进入上下文，不能称为有用回忆。规划模拟额外要求最低 DF 大于零，正式规格没有该门槛；本实验保持正式规则，没有为接近规划的浮现率而筛掉线索。\n`;
 md+='\n## 假设（呈现层）\n\n';for(const[id,h]of Object.entries(result.hypotheses)){const evidence=id==='H2-b'?{older_than_1d:h.evidence.older_than_1d,total_gain:h.evidence.total}:h.evidence;md+=`- ${id}：**${h.status}**；${cell(evidence)}。${h.status==='supported'?'本次冻结判据的推翻条件未成立。':h.status==='refuted'?'本次冻结判据的推翻条件成立。':'现有数字不足以作出判断。'}\n`;}
 md+='\nH1-o 的工具由脚本在探针时必定调用，不证明自主回想；H2 的增益并不否定噪声、回声和预算消费。逐次增益及旧答案年龄保存在 JSON，不作选择性删改。\n';
 md+='\n## 两段生活的浮现统计\n\n每回合字数含浮现消息的固定文字和时间，未浮现计零。回声按实际档案顺序判定；同一时间戳的较早探针仍可能被后来的文字摘抄。相邻重复率的分母是全部相邻回合对。非携带者字数是探针中不携带任何目标答案的整段文字字数。\n';
 for(const arm of ['E-S','E-SR','E-SC']){const a=run('life-a',arm).surfacing,b=run('life-b',arm).surfacing;
  const metrics=[['探针浮现率',s=>pct(s.turns.probe.rate)],['非探针浮现率',s=>pct(s.turns.nonprobe.rate)],['每回合字数均值 / p95',s=>fmt(s.chars.mean)+' / '+s.chars.p95],['非携带者字数',s=>s.noncarrier_chars],['选入次数 / 不同文字',s=>s.occurrences+' / '+s.unique],['最常见5段占比',s=>pct(s.top5_share)],['单段最多次数',s=>s.max_repeats],['相邻回合重复率',s=>pct(s.adjacent_repetition_rate)],['年龄 <1 / 1–7 / 7–28 / >28 天',s=>Object.values(s.ages).join(' / ')],['回声次数 / 占比',s=>s.echo.occurrences+' / '+pct(s.echo.ratio)],['与前景 / 窗口重复',s=>s.duplicates.foreground+' / '+s.duplicates.window],['有携带者答案 / 全答案',s=>s.carrier_candidates.with_carrier+' / '+s.carrier_candidates.total],['候选 / 有携带者',s=>pct(s.carrier_candidates.candidate_rate_over_carriers)],['选中 / 有携带者',s=>pct(s.carrier_candidates.selected_rate_over_carriers)],['选中 / 已成候选',s=>pct(s.carrier_candidates.selected_given_candidate)],['未选原因',s=>cell(s.carrier_candidates.omitted)]];
  md+=`\n### ${arm}\n\n| 指标 | life-a | life-b |\n| --- | --- | --- |\n`;for(const[label,get]of metrics)md+=`| ${label} | ${get(a)} | ${get(b)} |\n`;
 }
 md+='\n候选到浮现的排除是单独的选择损失，含已在前景的文字；它与“最终答案未被任何渠道呈现”的遗漏不同，不能把 foreground 排除当成答案消失。\n';
 md+='\n## recall 与请求成本\n\n| 生活 | 调用 | 返回段数均值/p95 | 返回字数均值/p95 | 扫描回退 |\n| --- | ---: | --- | --- | --- |\n';for(const life of ['life-a','life-b']){const r=run(life,'E-R').recall;md+=`| ${life} | ${r.calls} | ${fmt(r.results.mean)}/${r.results.p95} | ${fmt(r.chars.mean)}/${r.chars.p95} | ${cell(r.fallbacks)} |\n`;}
 md+='\n| 生活/臂 | 每回合请求字数均值/p95 | 相对 P8-A0 增量均值/p95 | 清单字节中位数/最大 |\n| --- | --- | --- | --- |\n';for(const[key,r]of Object.entries(result.runs)){const c=r.p9cost;md+=`| ${key} | ${fmt(c.turn_chars.mean)}/${c.turn_chars.p95} | ${fmt(c.vs_p8_a0.mean_delta)}/${c.vs_p8_a0.p95_delta} | ${c.manifest_bytes.median}/${c.manifest_bytes.max} |\n`;}
 md+='\n这些是字符与请求的成本代理，不是实际模型 token、缓存或账单。墙钟分别保存在 timing.json，不参与确定性比较。\n';
 md+='\n## 更正版本的实际呈现\n\n| 生活/臂 | 探针 | 各版本被浮现 | 各版本经 recall | 最终是否全呈现 |\n| --- | --- | --- | --- | --- |\n';for(const[key,r]of Object.entries(result.runs))for(const c of r.corrections)md+=`| ${key} | ${c.probe} | ${c.versions.map(v=>v.target+':'+v.surfaced_writing).join(', ')} | ${c.versions.map(v=>v.target+':'+v.recall_writing).join(', ')} | ${c.all_presented} |\n`;
 md+='\n程序没有替模型采用更正，也没有删除旧版本；完整请求中各版本的顺序另见 JSON 的 presentation_order/chronological。\n';
 md+='\n## 逐探针、渠道、排名、遗漏\n\n表中 E-R 的 rank 是携带者的 recall 排名，其余为原始答案的 check 排名；两者不是同一种量。JSON 保留 P8 的 rank/overlap 口径，新增 recall_rank 单列；浮现候选另从真实线索与历史清单统计。\n\n| 生活/臂 | 探针/答案 | P8 A0/A2 | P9 呈现渠道 | rank | 原因 |\n| --- | --- | --- | --- | ---: | --- |\n';
 for(const[key,r]of Object.entries(result.runs))for(const p of r.probes)for(const a of p.answers){const baseline=arm=>p8.runs[`${r.life}-${arm}-excerpt`].probes.find(v=>v.id===p.id).answers.find(v=>v.target===a.target).presented;md+=`| ${key} | ${p.id}/${a.target} | ${baseline('A0')}/${baseline('A2')} | ${['window','writing','check','check_writing','recall_writing','surfaced_writing'].filter(k=>a[k]).join(',')||'无'} | ${(r.arm==='E-R'?a.recall_rank:a.rank)??'无'} | ${a.reason??'已呈现'} |\n`;}
 md+='\n## 遗漏复现\n\n```sh\n';for(const[key,r]of Object.entries(result.runs))for(const p of r.probes)if(p.answers.some(a=>!a.presented))md+=`npm run eval -- explain ${root}/${key} ${p.id}\n`;
 md+='```\n\n## 限制与 P9-R\n\n没有真实模型调用或费用授权，P9-R 未执行。life-r 与预算护栏仅由离线假模型验证。后续获授权后检验 H7 的自发工具调用率、H1-r 的答案携带率、H2-r 的回答提及与闯入代理；不得将本报告的检索/呈现结果代替这些真实模型结论。浮现保持默认关闭。全部未解释遗漏为零；原因是机械记录，不是对模型心理的解释。\n';return md;
}
