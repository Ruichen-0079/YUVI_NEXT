# P8 最终原始证据（2026-11-03）

正式修订7944701已整合。全部数据来自独立合成档案与离线假模型，运行在无外网、仅回环namespace中；没有任何真实模型或私人档案。原始临时目录保留，不提交数据库。日志只将工作区/主目录绝对路径替换为`<repo>`/`<home>`，没有改写断言或结果。

## 文件

- `manifest.json`：实现/规格版本、源码SHA-256、Node版本、机器与CPU分配、最终测试计数及基线摘要。
- `million.json`：两种100万事件形态的完整20次样本、health序列、schema、P7/P8普通回合程序/假模型耗时、启动、RSS、增量最大值；明确记录实际engine及scan与index是否为同一集合。varied全部门槛通过；typical只报告，health p99=121.838 ms的false原样保留，不把它描述成通过。
- `retrieval-validation.json`：保留百万档案的独立R1–R30验证，30项全通过；R10 scan为1且只命中T6。
- `rebuild-check-audit.json`：重建期间实际新增5条checked，均scan/index_building；排除typical生成器中已有的旧checked。
- `scan-worker.json`：实际P8只读线程路径与原scan同机同档案交替预热/20采样，总数和结果集合相同；p95为416.870/417.754 ms、比值0.998，低于1.25。该阈值是否作为强制门槛按负责人安排交Claude最终审查；未为此更改扫描语义。
- `evaluation-runs.json`：baseline与regress两个完整63天/8组合的各自driver计数与timing，墙钟不进入确定性比较。
- `independent-audit.json`、`regress-independent-audit.json`：不导入产品/驱动/统计器的独立档案核对，两次各8组合全通过。核对主答案、四种渠道、全部文字消费记录、实际check参数/engine、请求/事件计数、UUID引用规范化摘要。不是声称Claude已经完成E4；独立验收仍由其另写驱动重算。
- `explanations.json`：5次实际`explain`命令及完整输出，覆盖no_check、substring_miss、no_overlap、recency_cut、ranked_out。
- `npm-test-node*.log`：Node22.16与22.23的完整`npm test`，各149/149通过。
- `certified-node*.log`：同一完整套件以`node --test --test-concurrency=1 test/*.test.mjs`再运行，参数位于文件列表之前，是真正逐文件串行；各149/149通过。
- `pre-fix-node*.log`：新E1断言检出F8仅1122字时的完整失败记录，修复为1500字后才生成最终基线。
- `targeted.log`：评测/索引/检索定向41项通过。
- `baseline.log`、`regress.log`、`audit.log`、`regress-audit.log`、`explain.log`、`million-validation.log`、`scan-worker.log`、`offline-ci.log`：相应命令原始结果。

基线JSON位于上两级`P8-baseline.json`，SHA-256为`c7f2a5a6a99f4c026b957319640b927fff13a7942862f5339a4b6b7a1c55a93c`。baseline为535.017秒，regress为499.860秒，八组合指标与规范化档案摘要逐字节一致；两个目录分别保留于`.local-data/p8-baseline-F0vnyO`和`.local-data/p8-baseline-kDzJeF`。

## 复现命令

参见[最终自查](../../P8-self-check.md)。测量命令如下（CPU分组只为记录本次环境，不是产品配置）：

```sh
unshare -rn sh -c 'ip link set lo up; taskset -c 12-23 npm run eval -- baseline'
unshare -rn sh -c 'ip link set lo up; taskset -c 12-23 npm run eval -- regress'
unshare -rn sh -c 'ip link set lo up; taskset -c 0-7 node scripts/p8/benchmark.mjs .local-data/p8-nov-million'
unshare -rn sh -c 'ip link set lo up; node scripts/p8/validate-retrieval.mjs .local-data/p8-nov-million'
unshare -rn sh -c 'ip link set lo up; taskset -c 8-11 node scripts/p8/scan-probe.mjs .local-data/p8-nov-million/varied/seed .local-data/p8-nov-scan-worker.json'
node scripts/p8/audit-evaluation.mjs .local-data/p8-baseline-F0vnyO
node scripts/p8/audit-evaluation.mjs .local-data/p8-baseline-kDzJeF
```

Node必须为所记录版本。benchmark输出目录必须不存在，复现时换新路径；生活数据源、快照和两次为修正夹具而中止的开发运行均未自动清空。

## 沿用证据

上级目录的`kill-rebuild.json`、`kill-increment.json`、`node2215-unsupported.json`分别是原有有效K8/K9/K11实测：真实百万事务SIGKILL、真实增量事务SIGKILL、实际无FTS5 Node22.15。相关运行时代码未变，未重复耗费整套百万研究，也未将它们伪称为本轮新测。其余上级失败日志/旧性能数据为2026-10-23历史证据，最终口径以本目录为准。
