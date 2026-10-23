# P8 原始证据（尚非全部通过）

这些文件均来自离线假模型与独立合成数据。没有真实生活档案或模型 API。测试日志只将工作区绝对路径替换为 `<repo>`；断言、计数、耗时和失败均保留。

- `million.json`：定稿共享词表下，seed=67、varied/typical各100万事件；每项预热后20次的所有耗时、health原始序列、P7/P8程序/模型耗时、RSS与schema。`passed.retrieval=false` 未被改写：R17 走 scan，超过正式 P3 字面B类门槛。
- `rebuild-check-audit.json`：从两个活跃重建测试档案独立读取新增的5条 checked；全部是 scan/index_building。过滤基准 seq≤1,000,000，避免把 typical 生成器植入的旧 checked 算成新回合。
- `retrieval-validation.json`：对保留百万档案逐项验证R1–R30，29项通过，R10正式scan断言失败；保留全部选取元数据及结果引用。
- `kill-rebuild.json`：百万合成档案，真实重建事务 SIGKILL 后的成功 K8。该次脚本后续 K9 的夹具失败未纳入此 JSON；不是整次脚本全部通过。
- `kill-increment.json`：修正夹具后单独执行 K9，真实增量事务 SIGKILL，终结事件已提交，重启后完整验证与档案摘要一致。
- `node2215-unsupported.json`：实际 Node22.15 无 FTS5 的真实服务降级。
- `offline-ci.log`：Node22.16 离线安装依赖。
- `initial-node*.log`：早期完整回归，40秒墙钟断言与R10失败。
- `intermediate-node*.log`：单调时钟长流测试修正后的完整回归，退避截止时间与一次端口竞争仍失败。未用定向复跑掩盖完整回归结果。
- `baseline-blocked.log`：正式 baseline 命令实际失败于冻结 anchor 的唯一性断言。不是九周基线结果。

`certified-node22.16.log` 与 `certified-node22.23.log`：最新完整离线回归，均148项、146通过、2失败、0跳过；2个失败是同一个R10子测试及其父测试。P1–P7与其余P8检查通过。命令如日志所示，附加参数在文件列表之后，不作为逐文件串行执行的证明；若需要串行复现，请先构建后用 `node --test --test-concurrency=1 test/*.test.mjs`。

## 方法与复现

见上级 [自查与命令](../P8-self-check.md)。百万测量由 `scripts/p8/benchmark.mjs` 生成并执行真实服务；基线对照为main/P7提交3343efa。测量期间已完成来源校验与共享词表，之后仅补充扫描线程异常退出处理及测试/报告，不改变排序和测量查询。机器为 Linux x86_64 / Intel Core Ultra 9 275HX、24逻辑CPU；数字不替代正式验收机结果。

K8 的百万档案来自前一版合成词表（生成器代码见2550a10），只用于完整性与杀进程验证，不混入本次定稿词表的性能数字。K9 使用独立41事件基准。临时源档案、快照与失败夹具均保留在忽略的 `.local-data/p8-*`，未提交数据库。
