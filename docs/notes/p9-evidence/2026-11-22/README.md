# P9 复审修复与独立复验离线证据（2026-11-22）

本目录记录 2026-11-22 由 **GPT-6.2 Sol** 对 PR #23（`0a9802f`）进行独立代码与证据审查后，针对其检出的 3 项阻塞项与低风险收紧项由 Sol 实施修复、再由 **Neon** 独立全量复验的离线实测证据。全程仅使用合成档案与回环假模型，外部网络隔离（`unshare -rn`），未运行真实/付费模型，未接触真实私人数据。

## 2026-11-22 修复摘要（Sol 实施、Neon 独立审阅与复验）

1. **超长合法词元统一索引编码（`src/archive-index.ts`）**：UTF-8 超过 16 KiB 的词元在写入 FTS5 `terms`、`MATCH`、`term_df` 哈希与 `verifyIndex` 时统一编码为 `'\u2063' + sha256(term)`（67 字节，单不断裂 FTS5 `ascii` 词元，数学上与 `terms()` 产出不相交），彻底消除 SQLite FTS5 在 32,768 字节处静默截断导致的 `total=0` 却误命中同前缀长词与全量校验 `mismatch`；清单仍保留原始词元。
2. **启动校验与运行时 DF 有效性校验 + `docs_wrote` 对象校验（`src/archive-index.ts`）**：在 `metadata` 同事务维护 `doc_count`，使用 `SELECT CASE WHEN doc BETWEEN 1 AND 9007199254740991 THEN doc END AS doc` 避免越界大整数抛 `RangeError` 与 `NaN < 1` 绕过；在 `verifyIndex()` 与运行时 `words()` 均强制检验 `1 <= doc <= doc_count` 安全整数及 `docs_wrote` 索引存在，异常立即触发损坏恢复重建。
3. **P5 与 P9 基准脚本修复（`scripts/p8/benchmark.mjs`、`scripts/p9/benchmark.mjs`）**：P5 在线重建显式传入 `recall: options.recall === 1`；R17 改为经真实异步 `index.scan` worker 路径与同档案原扫描对照；P9 逐次校验 `t3 >= t2`、断言启用浮现时样本数为 `trials + 2` 且 `p95_ms !== null`。
4. **回归测试（`test/p8-index.test.mjs`）**：新增 16,384 / 32,768 / 32,769 字节及多字节超长词（全量与增量路径）测试，以及 `term_df` 越界/非数字/超安全整数、`doc_count` 篡改与删除 `docs_wrote` 的启动及运行时恢复测试。

## 证据清单

- `test-node22.16.txt` / `test-node22.22.txt`：官方 Node 22.16.0 与 22.22.0 上完整离线 `npm test`（含 Chromium），各 **202/202 通过**，0 失败、0 跳过。
- `regress-run.txt`：Node 22.22.0 上全新完整 P8 `regress`（9.52 分钟）与 P9 `regress-p9`（12.55 分钟），逐字节匹配冻结的 `docs/notes/P8-baseline.json` 与 `docs/notes/P9-baseline.json`。
- `selection-audit.json`：对本次 8 组 63 天档案运行独立时序 FTS5 + `fts5vocab` 核对（37,998 次浮现选择、68 次索引 recall 排名、52,900 次请求摘要，0 差异）。
- `million.json`：百万 `writings` 与 `varied` 实测（ext4 NVMe、EPP=`performance`、无并行负载），P1/P2/P3/P4 全项 8/8 通过（`varied` 完整回合 p95 `27.25 / 40.04 ms`，直接浮现 `5.82 / 5.39 ms`；`writings` 完整回合 `66.47 / 21.90 ms`，W4 `0.63 ms`，W6 比值 `1.007`）。
- `p8-default-million.json`：P5 默认配置（`recall=on, surfacing=off`）百万 `varied` 实测，全 8 项门槛通过（真实 `recall=on` 在线重建 `health p99 = 1.72 ms`、R17 真实 `index.scan` worker 比值 `1.013`、普通回合 p95 `14.62 ms`、启动增量 `+857.92 ms ≤ 1,000 ms`、索引/档案比 `0.954`）。
- `million-verify.json`：三份百万派生索引范围核对（`invalid=0`）、权限 `600`、快速校验 `ok`、`docs_wrote` / `doc_count` 校验及全量 `vocab` ↔ `term_df` 逐词双射核对（56,531 / 61,993 / 62,016 词，0 差异）。
- `kill-probe.json`：真实 `SIGKILL` 中断 `rebuild` 与 `increment` 事务恢复实测（`rebuild: true, increment: true`，恢复后 `verify --full` 返回 `ok`，原档案 SHA-256 不变）。

性能硬件：Intel Core Ultra 9 275HX（24 逻辑 CPU）、ext4 NVMe SSD、Node 22.22.0，快于 4 vCPU / 2.1–2.8 GHz 级环境。
