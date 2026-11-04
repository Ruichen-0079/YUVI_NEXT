# P9 规划探针（2026-11-04）

为 [P9](../../../../P9.md) 的浮现代价与预期量级提供依据。只用 P8 的合成数据；不是产品代码，不被 `npm test` 运行。环境：4 vCPU 2.8 GHz，Node 22.22.0。

| 文件 | 内容 | 结果 |
| --- | --- | --- |
| `surface_probe.mjs` | 在 P8 验收时生成的 100 万事件 `varied` 索引上，用档案中真实的负责人消息作线索，按 P8 的裁剪规则检索 `wrote`，前 20 名 | [`results/p9/surface-cost-1m.txt`](../results/p9/surface-cost-1m.txt) |
| `surface_sim.py` | 在 P8 基线两段 9 周生活（A0、`excerpt`）的档案上逐回合模拟浮现：按当时的档案状态建 FTS5，排除前景文字，至多 3 条、2,000 字 | [`results/p9/surface-sim-p8-lives.json`](../results/p9/surface-sim-p8-lives.json) |
| `my_measure.py` | P8 验收时 Claude 独立编写的切分与统计程序（`surface_sim.py` 复用其中的切分） | — |

## 复现

```sh
npm run build
node surface_probe.mjs <P8 varied 1M>/index.sqlite <P8 varied 1M>/archive.sqlite
npm run eval -- baseline   # 生成 P8 的 9 周档案（.local-data/p8-baseline-*/）
python3 surface_sim.py .local-data/p8-baseline-*/life-a-A0-excerpt eval/lives/life-a.json docs/research/memory/probes/p9
```

## 要点

- **代价：** 每回合一次浮现检索，100 万事件下 p50 约 28 ms、p95 约 32 ms（单次最大约 40 ms）。加上 P8 的普通回合开销（p95 约 4.5 ms），仍远低于 100 ms。
- **触发频率：** `life-a` 中约 5% 的回合会浮现，`life-b`（高频话题）中约 21%。
- **命中：** 在探针回合，浮现带回答案携带者的比例很低：`life-a` 8/38、`life-b` 7–9/38。主要原因之一是此前的同类问话也被摘抄进文字，与原事实竞争（“回声”）。这是要测量的现象，不是要修复的缺陷。
- **裁剪上限：** 在生活规模（2–4 万文档）上，P8 的候选上限（5 万）与更严的 300–5,000 几乎没有差别；它只在百万规模上限制成本。P9 因此直接沿用 P8 的检索词规则。
- 这些数字只是规划依据（按当时档案状态逐回合计算，但只有 `excerpt` 假模型的文字），不是 P9 的验收门槛。
