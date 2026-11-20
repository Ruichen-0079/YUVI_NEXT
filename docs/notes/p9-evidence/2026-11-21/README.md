# P9 收尾修复与自验离线证据（2026-11-21）

本目录记录 2026-11-21 针对 PR #23 `REQUEST CHANGES` 阻塞项与 4 项非阻塞补充的修复后离线实测证据（由 Neon 执行并自审，不代替独立第三方验收）。全程仅使用合成档案与回环假模型，外部网络隔离（`unshare -rn`），未调用真实模型、付费 API、其他 AI 会话或接触真实私人数据。

## 变更摘要

1. **派生索引 `format=2`（`src/archive-index.ts`）**：新增 `term_df(term_hash BLOB PRIMARY KEY, doc INTEGER NOT NULL) WITHOUT ROWID`（32 字节 SHA-256 哈希键，满足普通表字段 ≤256 字节约束）以 O(1) 主键查表替代 `fts5vocab('row')` 倒排扫描；新增单列部分覆盖索引 `docs_wrote(seq) WHERE kind='wrote'`；`buildIndex` 按哈希序单事务写入 `term_df` 并以 `format=0→2` 保证中断可恢复；运行时 `appendBatch` 保持同事务文档级去重增量更新；`verifyIndex --full` 校验 `term_df` 与 `vocab` 逐词一一对应。不改动 `archive.sqlite`、切分器、DF 定义、裁剪、BM25 或任何选取语义。
2. **P1 计时区间修复（`scripts/p9/benchmark.mjs`、`scripts/p8/benchmark.mjs`）**：改由 `POST /api/messages` 发起时刻 `frames.sentAt` 计时，`program = (done.at - frames.sentAt) - sum(provider t3 - t2)`，分别记录 `pre_model`、`post_model`、`wall`、`provider`，对负值直接抛错拒绝（替代旧版在同步浮现完成后才到达客户端的 `heard.at`）。
3. **4 项非阻塞项闭环**：补齐 `P9-baseline.md` 与 `eval/p9.mjs` 的探针/回声双口径说明（不改冻结 JSON）；新增字面量 `recall` 工具描述自动化测试；补强 P9-R 事后 `usage` 单次在途请求超额说明；重测并报告 P5 默认配置普通回合与相对 P7 的启动增量。

## 证据清单

- `test-node22.16.txt` / `test-node22.22.txt`：官方 Node 22.16.0 与 22.22.0（经官方 `SHASUMS256.txt` 校验）上完整 `npm test`（含 Chromium），各 **198/198 通过**，0 失败、0 跳过。
- `regress-run.txt`：Node 22.22.0 上全新执行的 `npm run eval -- regress-p9`（含全新完整 P8 `regress` 9.22 分钟，总计 22.13 分钟），逐字节复现冻结的 `docs/notes/P8-baseline.json` 与 `docs/notes/P9-baseline.json`。
- `selection-audit.json`：对本次 `regress-p9` 生成的 8 组 63 天档案运行独立时序 FTS5 + `fts5vocab` 核对（37,998 次浮现选择、68 次索引 recall 排名、52,900 次请求摘要，0 差异）及含 S1–S7 / 仅主 P 探针的回声实测对照。
- `million.json`：百万 `writings` 与 `varied` 的修正后 P1–P4 实测（ext4 NVMe、无并行负载），P1/P2/P3/P4 全项 8/8 通过；含原始样本、`pre_model`/`post_model`/`wall`、查询计划（均使用 `COVERING INDEX docs_wrote`）、RSS 与索引大小。
- `p8-default-million.json`：P5 默认配置（`recall=on, surfacing=off`）百万 `varied` 实测，P8 全部 8 项强制门槛通过（含启动增量 `+871.68 ms ≤ 1000 ms`、在线重建 `health p99 = 2.91 ms`、普通回合 p95 `14.89 ms`）。
- `million-verify.txt`：三份百万派生索引范围核对（`invalid=0`），以及两份百万 `format=2` 索引的全量 `index verify --full`（`status="ok"`，权限 `600`）。
- `kill-probe.json`：真实 `SIGKILL` 中断 `rebuild` 与 `increment` 事务后的恢复实测（`rebuild: true, increment: true`，档案 SHA-256 不变，`verify --full` 返回 `ok`）。

## 复现命令

```sh
npm run build
unshare -rn sh -c 'ip link set lo up; YUVI_CHROMIUM=<chromium> npm test'
unshare -rn sh -c 'ip link set lo up; npm run eval -- regress-p9'
unshare -rn sh -c 'ip link set lo up; node scripts/p9/benchmark.mjs .local-data/p9-million-repro'
unshare -rn sh -c 'ip link set lo up; node scripts/p8/benchmark.mjs .local-data/p9-p8-default-repro --p9 1 --recall 1'
```

本机为 Intel Core Ultra 9 275HX（24 逻辑 CPU）、ext4 NVMe SSD，明显快于 4 vCPU / 2.1–2.8 GHz 级环境；本机结果仅代表本机实测，不等同于低主频容器的独立复测。
