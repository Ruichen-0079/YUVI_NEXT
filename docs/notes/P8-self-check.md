# P8 自查：已实测部分与未满足项

状态：**Draft / 尚不可验收**。未生成冒充完整63天基线的报告。下列规格矛盾均在 PR #22 留有具体复现与最小建议；Sol 未修改正式规格。

## R：检索

5万自动化子测试及百万保留档案复验：R1–R9、R11–R30 实测通过，**R10 未通过**。R13 的不命中是规定的负面结果。R10 的 index 命中正确，但原有 scan 总数为1，规格断言为0。R17 实测为 scan/no_terms；R24 在百万为 recent；R26 限定前32词并记录说明；R30 仅内部 wrote 过滤。R23 与 R28 的候选排序、强制选入、整条预算及最终顺序用独立 SQLite 查询核对。

## C：机制与兼容

| 项目 | 状态与证据 |
| --- | --- |
| C1 | Node22.16与22.23完整离线回归均148项/146通过/2失败/0跳过；两个失败为同一个R10子测试及父测试，仍未满足“全部通过” |
| C2 | 实测：原有协议/浏览器/快照恢复/进程差分回归；真实 P7 档案追加 P8 后，旧新清单均精确重建 |
| C3 | 实测：原请求级差分保留工具定义与无效参数检查；scan 只规范化规格明确改变的呈现说明和选取字段 |
| C4 | 实测：index/scan 呈现摘要及 CLI 重建一致；“强制最近条在真实前100之外”的字面矛盾待澄清 |
| C5 | 实测：直接 SQLite bm25 排序、R23/手工107候选、超预算强制两条完整保留 |
| C6 | 实测：5万事件语料、10条长句、1000条正文的 UTF-8/UTF-16LE 缺席、无内容表、短字段、权限与重建 |
| C7 | 实测：既有 P3 回归及新恢复目录重建；快照不包含索引 |
| C8 | 实测：首事件空库绑定、增量水位、同回合当前 heard 可检索 |
| C9 | 实测：其他场景、其他分支与 control 事件不被索引或返回 |
| C10 | 实测：NUL 解码边界、孤立代理查询、U+FFFD、emoji 与全角规范化 |
| C11 | 实测：引号、操作符及括号按普通文字切分，无查询注入错误 |
| C12 | 实测：工具呈现、裁剪/回退说明、原文保真与既有 D21 差分 |
| C13 | 已核对：无新依赖、无 events schema 变更、无新事件种类、src 不引用 eval |

## K：异常与恢复

K1–K7：实测单元与真实服务进程，覆盖缺失、截断、坏页、版本、水位、删行及真实换入另一档案；启动阶段无新事件，回合后既有行/BLOB/schema 不变，新事件种类序列与完好索引对照一致。

K8：真实百万事件重建事务内 SIGSTOP 后 SIGKILL，重新启动完成重建并逐行 full verify；前后档案全部行的摘要相同。见 `kill-rebuild.json`，仅该文件的 rebuild 场景为完成结果。

K9：真实增量事务内 SIGSTOP 后 SIGKILL；确认终结 said 已提交后杀进程，重启无额外恢复事件，full verify 为 ok。见 `kill-increment.json`。

K10：实测运行时不可写、scan 回退及固定错误文字；K11：实际 Node 22.15 无 FTS5 服务与 verify unsupported；K12：实际快照恢复后重建并检索；K13/K14：运行中拒绝 rebuild，verify 及冷目录维护逻辑只读，服务锁不变。WAL/SHM 协调变化按正式约定允许。

K8、K9 使用各自独立的成功运行，早期测试夹具曾因正常空闲整理及过早杀进程而失败，未将这些运行算作通过；原始临时目录仍保留。

## P：百万事件

同机 Node 22.23.3，Intel Core Ultra 9 275HX / 24逻辑CPU，Linux x86_64。不是正式验收机器，最终门槛由 Claude 独立测量。20次热采样，原始序列、schema、两种形态及同机 P7 基线见 `million.json`。

| 项目 | varied 实测 | 自查 |
| --- | --- | --- |
| P1 空建含 optimize | 37.309秒 | 达到5分钟门槛 |
| P2 在线重建 | 50.446秒；health p99 2.000 ms、最大7.122 ms、476样本；20回合/5 check全部完成且scan/index_building | 达标 |
| P3 罕见 A 类 | 最慢0.277 ms | 达标 |
| P3 其余真实索引 | 最慢 R26 74.005 ms；R24 24.583 ms；R28 3.948 ms | 这些索引请求达标 |
| P3 R17 scan 回退 | 412.483 ms；原 scan 427.986 ms | **按当前“其余全部”字面未通过，待澄清** |
| P4 普通回合程序 p95 | P7 5.177 / P8 4.719 ms；增量追平最大8.263 ms | 达标；不能据单次同机差异推断必然更快 |
| P5 启动 | P7 2325.109 / P8 2532.060 ms，增量206.951 ms | 达标 |
| P6 大小 | 索引320,978,944 / 档案339,525,632字节，比例0.945；1,000,000文档、44,903,106字符、81,502,310词元出现 | 达标 |

典型重复形态只报告：空建30.975秒，health p99 44.703 ms；P7/P8 普通回合 p95 5.680/5.563 ms，启动2257.599/2285.403 ms；P8 RSS163,848,192字节。varied P8 RSS175,464,448字节。R1 热查询0.252 ms vs scan603.397 ms（本机约2395倍），R10为1.541 vs555.106 ms（约360倍）；仅为这些查询的同机实测。

## E / X：评测与研究基线

- E1：**未通过**，规定 anchor 重复使63天脚本不能合法生成。
- E2：实测前14天 A0/A2 各双跑，metrics 字节及规范化档案摘要相同；完整八组合未验证。
- E3：实测快速检查中空闲/压力整理均真实触发且有 wrote，驱动不调用整理/组装；63天未验证。
- E4：独立手写档案夹具覆盖全部原因及引用条件；Claude 的独立重算尚未进行，不能代替正式 E4。
- E5：前14天两个 sanity 在全部快速检查中通过；完整S1–S7未验证。
- E6：快速检查 unexplained=0；完整生活及抽取5次遗漏未验证。
- E7：四次快速检查在90秒内完成（实际各版本测试日志）；完整 baseline 因 E1 失败，20分钟要求未验证。
- E8：完整 baseline/regress 未验证，不能提交虚构的 P8-baseline.json。
- E9：实测完整回归与评测快速检查在无外网、仅回环的 namespace 执行，只用合成数据。
- X1–X4：**尚未满足**。统计器及报告生成已实现，但未完成可信的九周数字、三个臂对照、负面结果与 WP-E 起点报告。

## 复现

使用 Node 22.16.0 或更新22.x，并为浏览器测试设置 `YUVI_CHROMIUM`：

```sh
npm ci --offline
unshare -rn sh -c 'ip link set lo up; npm test'
# 以下所有产物都是合成数据；输出目录必须不存在
unshare -rn sh -c 'ip link set lo up; node scripts/p8/benchmark.mjs .local-data/p8-million-reproduction'
unshare -rn sh -c 'ip link set lo up; node scripts/p8/validate-retrieval.mjs .local-data/p8-million-reproduction'
# 用生成器的独立合成快照执行真实杀进程，不接受真实私人档案
unshare -rn sh -c 'ip link set lo up; node scripts/p8/kill-probe.mjs <synthetic-snapshot.sqlite> .local-data/p8-kills-reproduction'
# 当前会如实失败于规格的 anchor 唯一性，不能绕过该检查
unshare -rn sh -c 'ip link set lo up; npm run eval -- baseline'
```

`benchmark` 当前因 R17 门槛冲突返回非零；`validate-retrieval` 因 R10 返回非零。这不是全通过的交付。收到 Claude 的正式修订后继续同一 PR，不自行放宽判据。
