# P8 规划探针（2026-10-23）

为 [P8](../../../../P8.md) 的性能门槛与评测驱动方式提供依据。只用合成数据；不是产品代码，不被 `npm test` 运行。

**环境：** Node v22.22.0（内置 SQLite 3.50.4），4 vCPU Intel Xeon 2.8 GHz，Linux。数字是规划依据，不是性能承诺；验收以 P8 §5 的测量方法为准。

| 文件 | 内容 | 结果 |
| --- | --- | --- |
| `fts1m.mjs` | 100 万条合成文档（Zipf 分布的 3,000 个汉字 + 400 个拉丁词，平均 112 字），按 P8 切分规则写入 FTS5 无内容表与 `docs` 表；测各类查询 | [`results/p8/fts-1m.txt`](../results/p8/fts-1m.txt) |
| `q1m.mjs` | 在上面的索引上测时间范围、种类过滤与按时间倒序 | 同上 |
| `inc.mjs` | 在 100 万条索引上逐回合追加（每批 4 条），测增量写入 | 同上（最后一行） |
| `clock-drive.test.mjs` | 进程内 `createApp` + `node:test` 模拟时钟 + 回环假模型，按天推进，让整理由服务自己的空闲计时器触发 | [`results/p8/clock-drive-8w.txt`](../results/p8/clock-drive-8w.txt) |
| — | 各 Node 22 版本内置 SQLite 的 FTS5 可用性 | [`results/p8/node-fts5.txt`](../results/p8/node-fts5.txt) |

## 复现

```sh
node fts1m.mjs /tmp/idx1m.sqlite 1000000     # 约 2.5 分钟，写入约 560 MB
node q1m.mjs /tmp/idx1m.sqlite
cp /tmp/idx1m.sqlite /tmp/idx1m-inc.sqlite && node inc.mjs /tmp/idx1m-inc.sqlite
# 需要已构建的 P7 代码（dist/）
DIST=/path/to/YUVI_NEXT/dist TZ=Asia/Shanghai node clock-drive.test.mjs
```

## 要点

- **Node 版本：** FTS5 从 Node 22.16.0（SQLite 3.49.1）起才可用；22.13–22.15 内置的 SQLite 没有 FTS5。
- **规模：** 100 万条、1.12 亿字：写入 117 s（其中切分 12 s）+ `optimize` 12 s；索引 560 MB。无内容表不保存正文，但倒排中的词元会与原文片段相同（P8 §3.1、C6）。
- **查询：** 罕见词、标识、自然问句（二元组 OR）都在 1 ms 以内。按 bm25 排序的成本与候选数成正比：13 万候选约 90 ms，90 万候选约 640 ms，5 个高频词 OR（94 万候选）约 1.25 s。按 `rowid` 倒序取最近 40 条在 1 ms 以内；`count(*)` 为 5–140 ms。
- **增量：** 每批 4 条，p50 0.06 ms、p95 0.2 ms、p99 2 ms；FTS5 自动合并偶尔产生约 0.4 s 的单次峰值。
- **模拟时钟：** 1,120 个回合（模拟约 5 周；结果文件名中的 `8w` 指 56 次循环，不是 8 周）在 8.8 s 内完成，112 次整理全部由服务自己的空闲计时器触发。要点是每次推进时钟后 `await app.idle()`，并让出一次事件循环。
