# P9 百万事件性能

2026-11-21（修复 `term_df` + `docs_wrote` 与 P1 计时区间后重测），本机 Linux 7.2.9、Intel Core Ultra 9 275HX（24 逻辑 CPU）、NVMe SSD（ext4）、Node 22.22.0。真实服务入口与回环假模型，外部网络隔离（`unshare -rn`）；各项性能测量均未并行运行其他基准。本机单核性能显著高于 4 vCPU / 2.1–2.8 GHz 级环境，不能把本机通过代称为低主频环境已通过。

## 计时口径修复说明

- **旧口径缺陷（2026-11-04）**：`scripts/p9/benchmark.mjs` 原先按 `calls[0].t2 - heard.at + done.at - calls[-1].t3` 计算回合程序时间。由于服务端写入 `heard` SSE 帧后立即同步执行 `selectDialogue`、`index.surface` 与 `assembleContext`，客户端读到 `heard` 帧（`heard.at`）往往晚于同步浮现结束，导致 `calls[0].t2 - heard.at` 漏计浮现耗时甚至出现负值。
- **新口径（2026-11-21）**：`scripts/p9/benchmark.mjs` 与 `scripts/p8/benchmark.mjs` 均改由 `POST /api/messages` 发起时刻 `frames.sentAt` 计时：
  - `pre_model = calls[0].t2 - frames.sentAt`
  - `post_model = done.at - calls[-1].t3`
  - `program = (done.at - frames.sentAt) - sum(provider t3 - t2)`
  - 任一区间为负值即直接报错失败，不再接受负延迟样本。

## P1–P4（修复前后同机对照）

每种形态 1,000,000 个事件；`writings` 有 24,412 段文字（其中 24,409 段为当前范围内非空文字，56,521 个独立词元），`varied` 有 251 段非空文字（61,984 个独立词元）。原始样本、查询计划（`relevance` 与 `recency` 均走 `COVERING INDEX docs_wrote`）、各线索结果、RSS、启动与空闲 health 均在 [million.json](p9-evidence/2026-11-21/million.json)；历史对照在 [2026-11-04/million.json](p9-evidence/2026-11-04/million.json)。

| 形态 / 策略 | 直接浮现 p50 / p95 / max（ms，旧→新） | 服务内浮现 p50 / p95 / max（ms，新） | 完整回合程序 p50 / p95 / max（ms，新 POST 起点） | 门槛 |
| --- | --- | --- | --- | --- |
| writings / relevance | 19.03 / 23.09 / 60.08 → **12.43 / 13.69 / 20.07** | **18.07 / 30.13 / 37.59** | **31.82 / 69.95 / 74.12** | P1 < 100、P2 ≤ 60 |
| writings / recency | 1.09 / 4.23 / 7.25 → **0.63 / 0.77 / 8.64** | **5.27 / 10.31 / 10.33** | **17.03 / 21.28 / 21.36** | P1 < 100、P2 ≤ 60 |
| varied / relevance | 33.07 / 41.85 / 47.65 → **5.06 / 5.94 / 12.22** | **12.82 / 37.67 / 45.18** | **30.24 / 89.81 / 95.49** | P1 < 100、P2 ≤ 60 |
| varied / recency | 30.66 / 40.18 / 41.73 → **3.44 / 5.46 / 15.72** | **9.43 / 13.04 / 14.44** | **21.93 / 25.65 / 26.22** | P1 < 100、P2 ≤ 60 |

- 对照关闭浮现（`surfacing=off`）的完整回合程序 p50 / p95：`writings` `13.06 / 18.22 ms`、`varied` `14.24 / 20.35 ms`。
- `varied / relevance` 完整回合中位数为 `30.24 ms`，第 15–16 回合恰逢 `archive.sqlite`（`PRAGMA synchronous=FULL`）与 `index.sqlite` 在 ext4 上同步触发 WAL 自动检查点（`post_model` 分别为 `67.7 ms`、`48.4 ms`），推高 p95 至 `89.81 ms`，仍低于 100 ms；未为跑分放松 `archive.sqlite` 持久性设置。
- **P3 / P4（`writings` recall W1–W11）**：W1/W2/W8 p95 为 `0.23 / 0.16 / 0.14 ms`（≤ 20 ms）；W3/W5/W7/W9/W10/W11 为 `0.08 / 0.19 / 0.32 / 0.08 / 0.31 / 1.68 ms`（≤ 200 ms）；无查询词最近列表 W4 由 `79.38 ms` 降至 **`0.53 ms`**（走 `COVERING INDEX docs_wrote`）。W6 扫描线程 p95 为 `292.08 ms`，与同机原扫描比值 **`0.999`**（≤ 1.25），总数与返回集合一致。
- **建立耗时与索引体积（`format=2`）**：
  - `writings`：建立 `86.32 s`（旧 `164.45 s`）；档案 `419,172,352` 字节、索引 `498,532,352` 字节（比值 `1.189 ≤ 1.5`，较旧版仅增 `2.27 MB / +0.46%`）；RSS `171.9–179.0 MiB`。
  - `varied`：建立 `46.91 s`（旧 `39.47 s`）；档案 `339,525,632` 字节、索引 `323,907,584` 字节（比值 `0.954 ≤ 1.5`，较旧版仅增 `2.93 MB / +0.91%`）；RSS `169.6–178.1 MiB`。
- 两份百万派生索引在服务测量结束后均通过 `verify-scope.mjs`（`invalid=0`）与全量 `index verify --full`（`status="ok"`，校验 `term_df` 与 `vocab` 逐词一一对应，权限 `600`），详见 [million-verify.txt](p9-evidence/2026-11-21/million-verify.txt)。

## P5：默认 recall 开、浮现关，保留 P8 门槛

在全新百万 `varied` 上重跑修正计时后的 P8 性能驱动（`--p9 1 --recall 1`）。原始 [结果](p9-evidence/2026-11-21/p8-default-million.json) 中 `service.p8` 是当前 P9 默认运行时，`service.p7` 是历史提交 `3343efa`，两者使用同一 `frames.sentAt` 计时口径。

- 从空重建含 `term_df` 与 `optimize`：**`68.41 s`**（≤ 300 s）；在线工作线程重建 **`45.39 s`**，重建后校验 `ok`。
- 在线重建期间每 100 ms 探测 health：p95 `1.19 ms`、**p99 `2.91 ms`**（≤ 100 ms）、0 失败；20 个回合全部 `done`，5 次 `check` 均为 `scan/index_building`。
- 全部走索引的 R 查询满足各自 20/200 ms 门槛（罕见词最大 p95 `0.30 ms`，其余索引查询最大 p95 `39.76 ms`）。R17 扫描比值 **`1.003`**（≤ 1.25），总数与集合一致。
- 默认配置普通回合程序 p50 / p95 / max（新 POST 起点口径）：P9 默认 **`11.80 / 14.89 / 20.58 ms`**（< 100 ms）；P7 `3343efa` 为 `10.56 / 11.84 / 13.24 ms`。增量追平 `catchUp` 中位数 / p95 / max 为 `1.95 / 2.51 / 10.68 ms`。
- 带完好 `format=2` 索引的启动耗时：`2,740.15 ms`（P7 为 `1,868.47 ms`），启动增量 **`+871.68 ms`**（≤ 1,000 ms）。
- 索引 / 档案比值 **`0.954`**（≤ 1.5）；全部 8/8 项 P5 门槛通过。

## 崩溃恢复（`format=2` + `term_df`）

在 50,000 事件合成 `varied` 档案上运行 `scripts/p8/kill-probe.mjs`（见 [kill-probe.json](p9-evidence/2026-11-21/kill-probe.json)）：在 `rebuild` 与 `increment` 事务中向真实服务发送 `SIGKILL`，重启后均自动恢复至 `verifyIndex --full` 返回 `ok`，原档案 SHA-256 与 `PRAGMA integrity_check` 完全不变。

## 复现

```sh
npm run build
unshare -rn sh -c 'ip link set lo up; node scripts/p9/benchmark.mjs .local-data/p9-million'
unshare -rn sh -c 'ip link set lo up; node scripts/p8/benchmark.mjs .local-data/p9-p8-default --p9 1 --recall 1'
```

使用独立新目录，固定 Node 22.22.0，避免并行重负载。全部样本来自离线假模型，不能作为真实模型费用、响应质量或记忆使用的证据。
