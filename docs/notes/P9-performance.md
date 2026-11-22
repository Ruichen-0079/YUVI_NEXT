# P9 百万事件性能

2026-11-22（在 Sol 审查并修复超长词索引编码、DF/文档数校验、P5 默认配置在线重建与 R17 真实扫描 worker 路径后由 Neon 独立重测），本机 Linux 7.2.9、Intel Core Ultra 9 275HX（24 逻辑 CPU，`energy_performance_preference=performance`）、NVMe SSD（ext4）、Node 22.22.0。真实服务入口与回环假模型，外部网络隔离（`unshare -rn`）；各项性能测量均未并行运行其他基准。本机单核性能显著高于 4 vCPU / 2.1–2.8 GHz 级环境，不能把本机通过代称为低主频环境已通过。

## 计时口径修复说明

- **旧口径缺陷（2026-11-04）**：`scripts/p9/benchmark.mjs` 原先按 `calls[0].t2 - heard.at + done.at - calls[-1].t3` 计算回合程序时间。由于服务端写入 `heard` SSE 帧后立即同步执行 `selectDialogue`、`index.surface` 与 `assembleContext`，客户端读到 `heard` 帧（`heard.at`）往往晚于同步浮现结束，导致 `calls[0].t2 - heard.at` 漏计浮现耗时甚至出现负值。
- **新口径（2026-11-21 起，2026-11-22 收紧）**：`scripts/p9/benchmark.mjs` 与 `scripts/p8/benchmark.mjs` 均改由 `POST /api/messages` 发起时刻 `frames.sentAt` 计时：
  - `pre_model = calls[0].t2 - frames.sentAt`
  - `post_model = done.at - calls[-1].t3`
  - `program = (done.at - frames.sentAt) - sum(provider t3 - t2)`
  - 逐次校验 `c.t3 >= c.t2` 及全部区间非负，任一区间为负值即直接报错失败；启用浮现时断言采样数严格等于 `trials + 2`（2 预热 + `trials` 正式回合）且 `p95_ms !== null`，避免 `null <= 60` 误判通过。

## P1–P4（修复前后同机对照）

每种形态 1,000,000 个事件；`writings` 有 24,412 段文字（其中 24,409 段为当前范围内非空文字，56,521 个独立词元），`varied` 有 251 段非空文字（61,984 个独立词元）。原始样本、查询计划（`relevance` 与 `recency` 均走 `COVERING INDEX docs_wrote`）、各线索结果、RSS、启动与空闲 health 均在 [million.json](p9-evidence/2026-11-22/million.json)；历史对照在 [2026-11-04/million.json](p9-evidence/2026-11-04/million.json)。

| 形态 / 策略 | 直接浮现 p50 / p95 / max（ms，旧→新） | 服务内浮现 p50 / p95 / max（ms，新，各 20 样本） | 完整回合程序 p50 / p95 / max（ms，新 POST 起点） | 门槛 |
| --- | --- | --- | --- | --- |
| writings / relevance | 19.03 / 23.09 / 60.08 → **12.17 / 13.49 / 17.97** | **18.32 / 27.03 / 36.28** | **32.79 / 66.47 / 67.93** | P1 < 100、P2 ≤ 60 |
| writings / recency | 1.09 / 4.23 / 7.25 → **0.64 / 0.72 / 6.22** | **5.51 / 10.62 / 11.94** | **17.61 / 21.90 / 28.18** | P1 < 100、P2 ≤ 60 |
| varied / relevance | 33.07 / 41.85 / 47.65 → **5.03 / 5.82 / 12.99** | **9.60 / 12.57 / 14.08** | **21.84 / 27.25 / 31.95** | P1 < 100、P2 ≤ 60 |
| varied / recency | 30.66 / 40.18 / 41.73 → **3.45 / 5.39 / 10.65** | **9.31 / 11.26 / 11.44** | **22.66 / 40.04 / 56.62** | P1 < 100、P2 ≤ 60 |

- 对照关闭浮现（`surfacing=off`）的完整回合程序 p50 / p95：`writings` `12.71 / 21.66 ms`、`varied` `13.71 / 18.27 ms`。
- **P3 / P4（`writings` recall W1–W11）**：W1/W2/W8 p95 为 `0.24 / 0.17 / 0.14 ms`（≤ 20 ms）；W3/W5/W7/W9/W10/W11 为 `0.25 / 0.23 / 0.32 / 0.09 / 0.30 / 1.60 ms`（≤ 200 ms）；无查询词最近列表 W4 由 `79.38 ms` 降至 **`0.63 ms`**（走 `COVERING INDEX docs_wrote`）。W6 扫描线程 p95 为 `280.03 ms`，与同机原扫描比值 **`1.007`**（≤ 1.25），总数与返回集合一致。
- **建立耗时与索引体积（`format=2`）**：
  - `writings`：建立 `83.64 s`（旧 `164.45 s`）；档案 `419,172,352` 字节、索引 `498,532,352` 字节（比值 `1.189 ≤ 1.5`，较旧版仅增 `2.27 MB / +0.46%`）；服务 RSS `168.9–181.1 MiB`。
  - `varied`：建立 `37.03 s`（旧 `39.47 s`）；档案 `339,525,632` 字节、索引 `323,907,584` 字节（比值 `0.954 ≤ 1.5`，较旧版仅增 `2.93 MB / +0.91%`）；服务 RSS `168.7–175.2 MiB`。
  - 注：上述 RSS 为服务稳态采样，不含高词汇量重建时的独立峰值内存测量。
- 三份百万派生索引在服务测量结束后均通过 `verify-scope.mjs`（`invalid=0`）、快速校验（`status="ok"`）、`docs_wrote` 与 `doc_count` 校验、权限 `600` 核查，以及全量 `vocab` ↔ `term_df` 逐词双射核对（56,531 / 61,993 / 62,016 词，0 差异），详见 [million-verify.json](p9-evidence/2026-11-22/million-verify.json)。

## P5：默认 recall 开、浮现关，保留 P8 门槛

在全新百万 `varied` 上重跑修复后的 P8 性能驱动（`--p9 1 --recall 1`）：在线重建段显式传入 `recall: true`（与普通回合段保持一致），R17 经真实异步 `index.scan` worker 路径与同档案原扫描对照。原始 [结果](p9-evidence/2026-11-22/p8-default-million.json) 中 `service.p8` 是当前 P9 默认运行时，`service.p7` 是历史提交 `3343efa`，两者使用同一 `frames.sentAt` 计时口径。

- 从空重建含 `term_df` 与 `optimize`：**`78.85 s`**（≤ 300 s）；在线工作线程重建（`recall=on`）**`65.24 s`**，重建后校验 `ok`。
- 在线重建期间每 100 ms 探测 health：p95 `1.23 ms`、**p99 `1.72 ms`**（≤ 100 ms）、0 失败；20 个回合全部 `done`，5 次 `check` 均为 `scan/index_building`。
- 全部走索引的 R 查询满足各自 20/200 ms 门槛（罕见词最大 p95 `0.33 ms`，其余索引查询最大 p95 `38.42 ms`）。R17 经真实 `index.scan` worker 的 p95 比值为 **`1.013`**（≤ 1.25），总数与集合一致。
- 默认配置普通回合程序 p50 / p95 / max（新 POST 起点口径）：P9 默认 **`11.22 / 14.62 / 22.21 ms`**（< 100 ms）；P7 `3343efa` 为 `11.13 / 12.49 / 12.57 ms`。增量追平 `catchUp` 中位数 / p95 / max 为 `1.97 / 2.45 / 85.18 ms`。
- 带完好 `format=2` 索引的启动耗时：`2,766.51 ms`（P7 为 `1,908.59 ms`），启动增量 **`+857.92 ms`**（≤ 1,000 ms）。
- 索引 / 档案比值 **`0.954`**（≤ 1.5）；全部 8/8 项 P5 门槛通过。

## 崩溃恢复（`format=2` + `term_df` + `doc_count`）

在 50,000 事件合成 `varied` 档案上运行 `scripts/p8/kill-probe.mjs`（见 [kill-probe.json](p9-evidence/2026-11-22/kill-probe.json)）：在 `rebuild` 与 `increment` 事务中向真实服务发送 `SIGKILL`，重启后均自动恢复至 `verifyIndex --full` 返回 `ok`，原档案 SHA-256 与 `PRAGMA integrity_check` 完全不变。

## 复现

```sh
npm run build
unshare -rn sh -c 'ip link set lo up; node scripts/p9/benchmark.mjs .local-data/p9-million'
unshare -rn sh -c 'ip link set lo up; node scripts/p8/benchmark.mjs .local-data/p9-p8-default --p9 1 --recall 1'
```

使用独立新目录，固定 Node 22.22.0，避免并行重负载与 `power` 节能限频。全部样本来自离线假模型，不能作为真实模型费用、响应质量或记忆使用的证据。
