# P8 最终自查

工程自测完成，提交云端Claude独立验收，最终合并由负责人决定。正式澄清7944701已整合；本表的“实测”是Sol的工程自测，不等于Claude已独立通过。

证据入口：[2026-11-03原始结果](p8-evidence/2026-11-03/README.md)、[九周报告](P8-baseline.md)、[确定性JSON](P8-baseline.json)。Node22.16.0与22.23.3完整离线回归各149项、149通过、0失败、0跳过，保留浏览器测试；同一最终套件另以参数置于文件列表之前的真正串行运行再次通过。

## R：5万与百万检索集

以下每项均实测通过，5万进入自动化测试，百万保留目标定位、选取元数据和结果集合。

| 项目 | 实测结论 |
| --- | --- |
| R1 | 年糕命中T1 |
| R2 | 命中T1/T2，按时间呈现 |
| R3 | 4A87命中T3 |
| R4 | 混合中文/标识命中T3 |
| R5 | 小写标识命中T3 |
| R6 | 中英混合命中T4 |
| R7 | 小写拉丁词命中T4 |
| R8 | 长文尾部蓝色鞋盒命中T5 |
| R9 | 拉丁罕见词命中T6且排名第一 |
| R10 | 300条干扰下index命中T6；原scan总数1、只返回T6 |
| R11 | 最早期罕见词命中T7 |
| R12 | 单字命中T8 |
| R13 | 不命中T9，无词元交集；规定的负面结果保留 |
| R14 | 乌龙命中T9 |
| R15 | 更正前后T10/T11均命中、时间顺序呈现 |
| R16 | 全角规范化命中T12 |
| R17 | scan/no_terms，命中T13；总数和集合与原scan一致 |
| R18 | silent的理由可查 |
| R19 | wrote可查且按内部文字呈现 |
| R20 | 不存在的词total=0 |
| R21 | 排除目标时间时total=0 |
| R22 | 精确边界包含目标 |
| R23 | total=60；直接SQLite核对bm25、强制条、整条预算、40条与最终时间顺序 |
| R24 | 5万按DF选择模式；百万为recent |
| R25 | 罕见词命中，裁剪规则不变 |
| R26 | 恰好500字查询，只用前32个词并说明 |
| R27 | 操作符按普通文字，无注入错误 |
| R28 | 只有时间范围时，从新选取、按时间呈现，独立核对预算 |
| R29 | 含孤立代理项的查询仍命中T1 |
| R30 | 内部wrote过滤命中灯塔、不返回年糕heard |

## C：机制与兼容

| 项目 | 结论 |
| --- | --- |
| C1 | 实测：离线npm ci；两个指定Node版本完整套件149/149，浏览器保留 |
| C2 | 实测：P1–P7回归、scan请求级差分及完整引用映射；真正P7档案追加P8后旧新请求精确重建 |
| C3 | 实测：工具定义字节与无效参数语义保持不变 |
| C4 | 实测：index/scan后续请求摘要与CLI重建；107候选例中最近长文排第107、保留真实前100、结果只允许该最近条例外 |
| C5 | 实测：直接SQLite bm25、R23/手工匹配集、超预算强制两条整条保留 |
| C6 | 实测：5万事件、10条长句、1000正文UTF-8/UTF-16LE检查、短字段、权限、无内容表、重建结果一致 |
| C7 | 实测：P3快照/验证/恢复及新目录重建，快照不含索引 |
| C8 | 实测：空库首事件绑定、水位追平与同回合heard可查 |
| C9 | 实测：其他场景、分支及control事件不被索引或返回 |
| C10 | 实测：NUL、孤立代理项、真实U+FFFD、emoji与全角；存储/解码保持原行为 |
| C11 | 实测：引号、通配符、冒号、布尔词、括号作为普通文字，不产生查询错误 |
| C12 | 实测：D21、工具说明、裁剪/回退与原文保真；不进行输出过滤 |
| C13 | 静态核对及回归：无新依赖、无events结构/触发器/索引变更、无新事件种类；src不引用eval |

## K：故障与恢复

| 项目 | 实测证据 |
| --- | --- |
| K1 | 删除索引后重建；百万在线重建期间5次check全部scan/index_building |
| K2 | 索引截断，verify识别、真实服务修复 |
| K3 | 坏页识别与重建；返回前来源校验还防止逻辑损坏泄露control内容 |
| K4 | tokenizer不匹配报version并重建 |
| K5 | through_id不符报mismatch并重建 |
| K6 | docs/FTS各删10行，行数不符识别并重建 |
| K7 | 停服后真实换入另一档案、保留旧索引；识别身份并只返回新档案内容 |
| K8 | 沿用有效百万事务内SIGKILL证据：重启重建后full verify为ok、全部档案行/BLOB/schema摘要不变 |
| K9 | 沿用有效增量事务内SIGKILL证据：said已提交后杀进程，重启无额外恢复事件且full verify为ok |
| K10 | 运行中不可写，固定错误文字、scan回退、回合正常追加 |
| K11 | 实际Node22.15无FTS5，真实服务scan回退，verify为unsupported |
| K12 | 实际快照恢复后重建索引，对既有材料结果一致 |
| K13 | 活跃服务拒绝index rebuild，索引与档案不变 |
| K14 | 活跃/冷目录verify逻辑只读，已提交内容与服务锁不变；允许WAL/SHM协调变化 |

K1–K7、K10、K12–K14均在当前完整回归覆盖；既有事件逐列/BLOB/schema不变，启动无业务写入时无新行，回合后新事件种类序列与完好索引对照一致。K8/K9/K11的运行时代码未被本轮修改，有效原始证据沿用，未伪称本轮重新执行。

## P：百万性能

Linux x86_64，Intel Core Ultra 9 275HX、24逻辑CPU，Node22.23.3。性能任务固定CPU0–7，生活评测固定12–23并行；实际扫描线程对照另在8–11。P3热采样20次、原始序列全部保留。不是正式验收机器，Claude须独立测量。

| 项目 | varied实测与结论 |
| --- | --- |
| P1 | 空建含optimize 35.692秒，达标 |
| P2 | 完整在线重建37.399秒；等待worker ready（包括optimize），health p99 2.693 ms、最大9.845 ms、351样本；20回合/5次scan回退全部完成，达标 |
| P3 index | A类最慢0.231 ms；B类最慢R26 56.650 ms；R24 19.851 ms、R28 3.061 ms，达标 |
| P3 scan | 同步查询计时R17 344.887 / 原scan349.428 ms（0.987倍）；实际只读worker路径416.870 / 原scan417.754 ms（0.998倍），总数/集合相同；不套用200ms门槛 |
| P4 | P7/P8普通程序p95 6.946/7.117 ms（本次增量0.170 ms）；追平最大4.563 ms，达标 |
| P5 | P7/P8启动1934.131/2047.676 ms，增量113.545 ms，达标 |
| P6 | 索引320,978,944 / 档案339,525,632字节（0.945倍）；100万文档、44,903,106字符、81,502,310词元出现；P8 RSS176,332,800字节，达标 |

按负责人指示，1.25倍是否为强制门槛交Claude最终规格审查确认；本次两种测量都低于1.25，不为该比值改变扫描语义。R1热查询0.223 ms vs scan469.754 ms，约2109倍；R10为1.299 vs465.426 ms，约358倍，只代表该查询本次同机观测。

typical只报告、不设门槛：空建17.255秒；health p99 **121.838 ms**（高于varied的100ms线，原始passed.health=false保留）；P7/P8普通程序p95 67.186/6.734 ms、启动1734.873/1874.075 ms、P8 RSS162,643,968字节。没有据单次同机差异断言普遍改善，也没有隐藏典型形态尾延迟。

## E：九周评测

| 项目 | 结论 |
| --- | --- |
| E1 | 实测：两段完整63天、22个新anchor与7暗号唯一，非F8在前32码点内；冻结原话/问话/时间/配置与修订前逐字段比较不变 |
| E2 | 实测：前14天A0/A2各双跑；完整63天8组合再跑一次，metrics与规范化档案摘要一致，最终汇总JSON逐字节相同 |
| E3 | 实测：每个life-a组合122次整理（idle52/pressure70），每个life-b组合402次（52/350）；none也记录空wrote；驱动不调用整理/组装 |
| E4 | 实测Sol独立审计8组合的主答案、四渠道、文字消费与规范化摘要；独立手写夹具覆盖全部原因。Claude按规格自行重算全部指标仍属外部验收，未宣称其已通过 |
| E5 | 实测：S1–S7全部8组合均呈现 |
| E6 | 实测：全部unexplained=0；五个实际explain命令复现五类遗漏，保留原始输出 |
| E7 | 实测：baseline535.017秒、regress499.860秒，均小于20分钟；两个版本四次快速检查小于90秒 |
| E8 | 实测：完整regress与提交JSON逐字节相同，SHA-256 c7f2a5a6a99f4c026b957319640b927fff13a7942862f5339a4b6b7a1c55a93c |
| E9 | 实测：全部测试/评测/性能运行在无外网、仅回环namespace，只读写独立合成档案，不加载真实密钥 |

## X：研究退出条件

| 项目 | 结论 |
| --- | --- |
| X1 | 已生成完整JSON及报告，用数字逐项回答Q1–Q6，逐探针结果/年龄/渠道/排名/更正/成本/文字消费均可查 |
| X2 | A0/A1/A2逐探针可对照，A2与A1的每次呈现差异列机械原因；普通生活7/36/37，高干扰0/23/28（均38答案） |
| X3 | 保留P20/R13预期失败及所有其他遗漏；高干扰A2有9个ranked_out与1个no_overlap，未调整规则追求成功数字 |
| X4 | 报告明确WP-E的H1/H2/H7对照与当前限制，不声称假模型理解、使用或采用更正 |

## 复现

使用Node22.16.0或22.23.3，并设置YUVI_CHROMIUM：

```sh
npm ci --offline
unshare -rn sh -c 'ip link set lo up; npm test'
# 真正串行：参数必须在文件列表之前
unshare -rn sh -c 'ip link set lo up; npm run build && node --test --test-concurrency=1 test/*.test.mjs'
unshare -rn sh -c 'ip link set lo up; npm run eval -- baseline'
unshare -rn sh -c 'ip link set lo up; npm run eval -- regress'
# 新输出目录必须不存在；全部生成数据为合成
unshare -rn sh -c 'ip link set lo up; node scripts/p8/benchmark.mjs .local-data/p8-million-reproduction'
unshare -rn sh -c 'ip link set lo up; node scripts/p8/validate-retrieval.mjs .local-data/p8-million-reproduction'
unshare -rn sh -c 'ip link set lo up; node scripts/p8/scan-probe.mjs .local-data/p8-million-reproduction/varied/seed .local-data/p8-worker-scan.json'
node scripts/p8/audit-evaluation.mjs <baseline-output-root>
```

具体命令、工具版本、CPU分配、原始样本与保留数据目录在证据README。现有临时数据不自动清空。
