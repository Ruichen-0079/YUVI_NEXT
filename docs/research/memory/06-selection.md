# 06　依赖与开源库选型调研

> 2026-10-21，Claude。针对 WP-A～WP-G 涉及的通用技术，比较成熟实现与自研，给出近期工作包的选型。
>
> 原则见 [AGENTS“依赖与架构选型”](../../../AGENTS.md)：成熟组件优先，系统集成从简，领域机制自主。
>
> - **依据：** 官方文档与发布页、npm 注册表元数据（版本、许可证、发布日期、依赖），以及隔离探针（[probes/](probes/README.md)）。
> - **数据：** 探针只用合成数据。数字只用于方案之间的比较。
> - **口径：** 版本与日期为 2026-10-21 查询结果。

## 0. 结论

| 领域 | 选择 | 新增依赖 | 仍需自己写的部分 | 何时重新选型 |
| --- | --- | --- | --- | --- |
| A 数据库与增量存取 | 继续用 `node:sqlite` | 无 | 按 `seq` 倒序的查询（改写现有函数） | `node:sqlite` API 出现不兼容变更；需要多进程写 |
| B 全文检索与中文 | SQLite FTS5（内置）+ 应用侧切分：汉字单字与二元组、拉丁词与数字 | 无 | 约数十行的切分与查询构造 | 实测精度不足 → 加 `Intl.Segmenter`（内置）或 `@node-rs/jieba` 的词 |
| C 语义检索 | 暂不引入；需要时：本地 llama.cpp `llama-server`（或 Ollama）+ Qwen3-Embedding-0.6B，经 OpenAI 兼容的 `/v1/embeddings` 调用 | 运行时进程，非 npm 依赖 | 向量存取与进程内暴力余弦 | 文字超过约 5 万条 → `sqlite-vec` |
| D 激活与动力学 | ACT-R 基础激活公式 | 无 | 公式本身（几行）与它和浮现/重整的相互作用 | 需要比较其他模型时，参考 FSRS（`ts-fsrs`） |
| E 后台任务 | 现有单队列 + 档案事件作为持久状态 | 无 | 无新增 | 出现多类并发后台任务和优先级 |
| F 评测与可观测 | `node:test`（已用）+ `mock.timers` 加速时钟 + 现有假模型服务 + 档案与呈现记录作为轨迹 | 无 | 每个机制所需的合成生活脚本与统计查询 | 需要大量提示对照实验时，考虑 promptfoo |

**结论不是“零依赖”，而是“这一阶段需要的成熟组件已经在运行时里”：**

- SQLite（含 FTS5、JSON、RTREE、`VACUUM INTO`、备份 API）；
- ICU（`Intl.Segmenter`）；
- `node:test` 的模拟时钟。

它们都是 Node 内置的，不增加安装与升级负担。

真正值得在以后引入的外部组件是**本地嵌入模型及其推理进程**；`sqlite-vec` 与 jieba 有明确的引入条件。

**因此取消或减少的自研工作：**

- 不写倒排索引、相关度排序、索引合并与增量维护（FTS5 已有）；
- 不写向量数据库（规模内暴力计算；更大时用 `sqlite-vec`）；
- 不写任务队列、租约、outbox（单实例，档案就是持久状态）；
- 不写迁移框架（WP-A～WP-C 都不改档案 schema；派生索引在独立文件中整体重建）；
- 不写通用评测平台；
- 不写嵌入模型的推理。

## 1. A　数据库与增量存取

### 1.1 `node:sqlite` 与 better-sqlite3

| | `node:sqlite`（现用） | better-sqlite3 |
| --- | --- | --- |
| 许可证 / 来源 | Node 内置（MIT） | MIT；13.0.3（2026-08-05）；2016 年至今持续维护 |
| 稳定性 | Node 22：1.1 活跃开发（22.13 起无需标志）；Node 25.7 起为 1.2 Release candidate | 稳定 API |
| 安装 | 无 | 原生插件；有预编译包，Node 主版本升级时需匹配 |
| 我们需要的功能 | FTS5、JSON、`VACUUM INTO`（P3 已用）、`backup()`（22.16+）、`loadExtension`（需 `allowExtension: true`）、事务状态 `isTransaction` | 都有；另有事务辅助函数 |
| 已知差异 | 外键默认开启；JS 整数按需绑定，`sqlite-vec` 的 rowid 必须用 BigInt（探针中遇到） | — |

**结论：继续使用 `node:sqlite`。**

- 更换带来的只有一个原生依赖和一层迁移工作，不能解决当前的任何问题。
- 风险在 API 仍可能变化。对策：
  - 代码只用基本 API（`prepare/run/all/get/iterate/exec`）；
  - 在 Node 22 EOL（2027-04-30）之前升到 Node 24 LTS（2028-04-30 EOL），并复跑全部测试。

Node 发布日程见 [nodejs/Release](https://github.com/nodejs/Release)；API 历史见 [Node 22 sqlite 文档](https://nodejs.org/docs/latest-v22.x/api/sqlite.html)。

### 1.2 增量存取：问题在查询方式，不在数据库

100 万事件的合成档案，P4 schema（[results/archive-1m.json](probes/results/archive-1m.json)，中位数）：

| 查询 | 不加索引 | 加 `(class, kind, seq)` 索引 |
| --- | --- | --- |
| 现状：读取并解码整张表（P4 每回合都这样做） | **45,005 ms** | — |
| 最近 200 个对话事件（`ORDER BY seq DESC LIMIT`） | 1.3 ms | **1,350 ms**（规划器选错索引） |
| 整理覆盖位置：最近一条 `wrote` / `unconsolidated` | ≈0 ms | — |
| 同上，但用 `max(json_extract(...))` 扫全部文字 | 153 ms | 12 ms |
| 近期文字（预算选入） | 5.4 ms | 0.4 ms |
| 尚未结束的 `heard`（`seq > ?`） | 2.7 ms | — |
| `check` 子串，罕见词（全表扫描） | 370 ms | — |
| `check` 子串，常见词（很快命中 40 条） | 0.1 ms | 787 ms |

**结论：**

1. WP-A 只需把回合路径改成按 `seq` 倒序、带 `LIMIT` 的查询，单项查询就在毫秒级。**不需要新增索引，不改档案 schema，也就不需要迁移机制。**
2. 一个看似合理的复合索引会让两条查询退化近千倍。任何档案索引都必须以真实查询的计划与测量为准，不能预先加。
3. `check` 的最坏情况（370 ms）留给 WP-C 的全文索引解决。

### 1.3 迁移与快照

- **迁移：**
  - 档案 schema 目前由 `src/schema.ts` 精确校验，WP-A～WP-C 都不需要改它；
  - 派生索引放在独立的 `index.sqlite` 中，版本不符就整体重建，不做迁移。
  - 将来档案确需改 schema 时，用 SQLite 自带的 `PRAGMA user_version` 加有序 SQL 步骤即可。不引入 umzug、Kysely、drizzle 等迁移框架：它们各自带一套状态与约定，而这里的需求是“几年一次、每次一两条 SQL”。
- **快照：** P3 用 `VACUUM INTO`，是 SQLite 的标准一致性副本方式，保留。`index.sqlite` 不进入快照的正确性前提，恢复后重建。

## 2. B　全文检索与中文分词（重点）

### 2.1 候选

| 方案 | 许可证 / 版本 / 维护 | 形态 | 与 V2 的契合 |
| --- | --- | --- | --- |
| **SQLite FTS5 trigram**（内置） | SQLite（公有领域） | 内置分词器 | 少于 3 字的查询无法走索引，只能退回 `LIKE` 全表扫描 |
| **SQLite FTS5 + 应用侧切分**（内置） | 同上 | 写入前把文本切成以空格分隔的词元，FTS5 用 `unicode61` 建索引 | 保留 FTS5 的倒排、bm25、增量合并、`fts5vocab`、无内容表；切分规则完全可控 |
| `Intl.Segmenter`（ICU，内置） | Node 官方构建带完整 ICU | 字典分词 | 词级切分；单字查询（如“茶”）落空 |
| [`@node-rs/jieba`](https://github.com/napi-rs/node-rs/tree/main/packages/jieba) | MIT；2.0.4（2026-10-06）；jieba-rs 的 napi 绑定 | 预编译原生包，无需编译工具链；词典单独导出 | 质量好、速度快；单字查询落空；多一个原生依赖 |
| nodejieba | MIT；3.5.8（2026-03-23） | C++ 原生插件（node-gyp） | 功能同上，安装更重 |
| jieba-wasm | MIT；2.4.0（2025-09-16） | WASM | 无原生依赖；更新较慢 |
| [wangfenjin/simple](https://github.com/wangfenjin/simple) | MIT 或 GPL-3.0+；v0.7.1（2026-02-23） | SQLite FTS5 的 C++ 扩展（jieba + 拼音） | 需要加载 `.so` 与运行时词典（首次加载约 4 s）；Linux 发布物按 Ubuntu 版本命名，未标架构；分词逻辑进入数据库扩展，升级与重建绑定在一起 |
| MiniSearch / FlexSearch / Orama | MIT / Apache-2.0 | 纯 JS，内存索引 | 不持久，启动时要整体载入；与已有 SQLite 重复 |
| Meilisearch / Tantivy / Elasticsearch | 各异 | 独立服务或 Rust 库 | 第二个存储与进程；对单实例单个体过重 |

### 2.2 探针

合成语料加 8 条植入目标（[probes/cjk.mjs](probes/cjk.mjs)）。目标包含 V1 R5 暴露过的失败形态：

- 两字短词（“茶叶”“年糕”）、单字（“茶”）；
- 标识（“露川-4A87”“4A87”）、中英混合（“VS Code 主题”）；
- 长文尾部标识、被 300 条高频干扰包围的旧事实（“amber spruce”）；
- 自然问句（“猫叫什么”）、换说法（“喜欢的茶” → “茶叶偏好”）。

**14 个查询的命中（目标进入前 8）：**

| 方案 | AND，2 万条 | OR + bm25，2 万条 | OR + bm25，20 万条 | 20 万条：写入 / 索引大小（无内容表） |
| --- | --- | --- | --- | --- |
| trigram | 11/14（短查询走 `LIKE`：20 万条约 120 ms） | 11/14 | 11/14 | 4.1 s / 62 MB（含内容） |
| `Intl.Segmenter` 词 | 11/14 | 12/14（缺“茶”“喜欢的茶”） | — | — |
| **汉字单字 + 二元组 + 拉丁词** | 12/14 | **14/14** | **14/14**，单次 < 1 ms | 9.3 s / **51 MB** |
| 词 + 单字 + 二元组 | 12/14 | 14/14 | — | — |
| jieba（搜索模式） | 11/14 | 12/14（缺“茶”“喜欢的茶”） | 12/14 | 5.8 s / 18 MB |

**说明：**

- **“喜欢的茶”的命中是偶然的：** 目标原文“我的茶叶”恰好含二元组“的茶”，不是语义命中。换说法仍然是文本检索的边界，属于 C 的问题。
- **AND 语义下自然问句全部落空**（“猫叫什么”里的“什么”不在原文中）。查询应当用 OR + bm25 排序，而不是要求全部词元出现。
- **低选择性查询的成本**（[fts-low-selectivity-200k.txt](probes/results/fts-low-selectivity-200k.txt)）：
  - 20 万条中由 5 个高频词元 OR 起来、匹配 10.9 万条时，排序约 100 ms，与匹配集大小成正比；
  - 同样词元用 AND 匹配 1,647 条时约 10 ms。
  - 这是倒排排序的固有成本（V1 R5 的同一结论）。对策是用内置的 `fts5vocab` 读出文档频率，丢弃过于常见的词元，并保留“结果受限”的说明。
- **已在 SQLite 3.50.4 上验证可用的 FTS5 功能：**
  - `content=''` + `contentless_delete=1`：索引不保存正文，仍可删除行，对应删改；
  - `fts5vocab`；
  - `rank` / `bm25`；
  - `optimize` / `automerge`。

### 2.3 结论

**采用 SQLite FTS5，在应用侧把文本切成“汉字单字 + 相邻二元组 + 拉丁词与数字”。**

- **它是 V1 R5 已验证的切分方式**（汉字单字 + 二元组），探针中召回最好。
- **无内容表下的索引大小可接受：** 20 万条 51 MB，按比例 100 万条约 250 MB。
- **倒排、排序、合并、增量维护、删除全部由 FTS5 完成。** 自己写的只有切分函数和查询构造，约数十行，且切分版本写进索引元数据；改切分就整体重建。
- **不需要任何外部依赖。**

**不选的理由：**

- trigram：两字查询无法走索引。
- 只用词级切分（`Intl.Segmenter` 或 jieba）：单字查询落空。
- `simple` 扩展：把分词逻辑与词典放进原生数据库扩展，升级、部署、重建三者绑定，收益只有分词精度。

**升级路径：** 如果评测显示二元组带来过多误命中，在同一列中追加 `Intl.Segmenter` 的词（内置，无新依赖）；仍不足时再评估 `@node-rs/jieba`。两者都只改变切分函数和索引版本，不改变存储结构。

## 3. C　语义检索与嵌入（WP-G，条件性）

### 3.1 嵌入模型

| 模型 | 许可证 | 要点 |
| --- | --- | --- |
| [Qwen3-Embedding-0.6B](https://huggingface.co/Qwen/Qwen3-Embedding-0.6B) | Apache-2.0 | 维度 32–1024 可选（MRL）；C-MTEB 66.33；支持指令；官方 [GGUF](https://huggingface.co/Qwen/Qwen3-Embedding-0.6B-GGUF) Q8_0 639 MB；V1 曾使用其 512 维 |

V1 的选型在 V2 中仍然成立：中文能力好、体积小、CPU 可运行、可选维度降低存储。

### 3.2 运行方式

| 方式 | 许可证 / 版本 | 负担 | 结论 |
| --- | --- | --- | --- |
| **llama.cpp `llama-server --embedding --pooling last`** | MIT | 独立进程；提供 OpenAI 兼容的 `/v1/embeddings`（[server README](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md)） | **首选**：V2 已经用 OpenAI 兼容协议调用对话模型，嵌入用同一种 HTTP 调用即可，不新增 npm 依赖；换模型或换成远端服务只改地址与模型名 |
| Ollama | MIT | 独立进程，自带模型管理 | 与上一项等价的备选；V1 实际使用过 |
| node-llama-cpp | MIT；3.22.2（2026-10-17） | 进程内原生绑定，二进制较大 | 不想多一个进程时的备选；把推理带进主进程，崩溃面变大 |
| transformers.js（`@huggingface/transformers`） | Apache-2.0；4.3.1 | 依赖 `onnxruntime-node`、`onnxruntime-web` 开发版与 `sharp` | 依赖过重，不选 |

### 3.3 向量存取

| 方案 | 实测（512 维，[results/vec.json](probes/results/vec.json)） | 结论 |
| --- | --- | --- |
| **进程内暴力余弦**（`Float32Array`，向量以 BLOB 存在 `index.sqlite`） | 1 万条 29 ms；5 万条 87 ms；20 万条 355 ms | **首选**。它的文字预计数千到数万条；用 MRL 取 256 维可再减半 |
| [sqlite-vec](https://github.com/asg017/sqlite-vec)（`vec0` 平坦检索） | 1 万 13 ms；5 万 65 ms；20 万 209 ms | 预 1.0（v0.1.9，2026-03-31）；ANN（DiskANN/IVF）仍在 alpha；可在 `node:sqlite` 中加载（需 `allowExtension`）。**超过约 5 万条或需要在 SQL 中过滤时再引入** |
| usearch、hnswlib、faiss、LanceDB | — | 规模远未需要 ANN；不选 |

**模型空间：**

- 每个向量带 `(模型名, 维度, 归一化, 指令文本)`，作为模型空间标识；
- 换任何一项就整体重建一代，旧代可保留用于对照（V1 R5 的教训）；
- 不对档案原文建向量：原文逐字查找仍走 FTS5。

**隐私：** 默认本地运行，私人文字不离开本机。是否允许送往外部嵌入 API 属于数据边界，由负责人决定（[05](05-decisions.md)）。

**资源：** 0.6B 模型 Q8 约 0.6 GB 内存，CPU 可运行；它的文字增量小，后台批量嵌入即可，不需要 GPU。

## 4. D　激活、联想与动力学

| 参考 | 可复用的部分 | 处理 |
| --- | --- | --- |
| ACT-R 基础激活 `B = ln Σ t_j^(−d)`（Anderson & Schooler, 1991；ACT-R 参考手册） | 公式与默认参数 `d = 0.5` | **直接采用公式**；用访问时间列表计算，几行代码 |
| Petrov (2006) 的基础激活近似 | 访问很多次时，用“最近 k 次精确 + 其余解析近似”避免逐项求和 | 访问历史变长时采用 |
| [pyactr](https://github.com/jakdot/pyactr)（Python，GPL-3.0） | 完整 ACT-R 模型 | **只作为对照**：用它独立算出几组数值，写进我们的单元测试；不复制代码（许可证与语言都不合适） |
| FSRS / [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs)（MIT；5.4.2，2026-09-01） | 稳定性 / 可提取性模型：在可提取性低时被想起，稳定性增加得更多 | **以后的对照候选**。它假设有“回答得好不好”的评分，YUVI 没有这种信号，直接采用会引入程序侧判断 |
| Generative Agents（Park 等, 2023）的检索分数：新近 × 重要性 × 相关性 | 新近按指数衰减与相关性相乘的组合方式 | 参考组合方式；**不采用“重要性”**：它由模型打分后存为记忆属性，不满足 [03 §1.1](03-architecture.md) 的第 2 条 |
| MemoryBank（Zhong 等, 2023）的艾宾浩斯遗忘 | 被想起后强化、随时间衰减 | 与 ACT-R 同类；作为对照组之一 |
| ACT-R 扩散激活 | 由当前线索到记忆的联想强度 | 以后的研究项：可以用共现关系（同一段材料、同一次呈现）计算，不需要语义标签 |

**结论：**

- 数学部分都是公开、简短、有参考值的公式，直接采用，不需要外部依赖。
- 真正需要研究的是：
  - **什么算“一次访问”**：形成、被 `recall` 返回、被线索浮现、被常规前景呈现；
  - 参数；
  - 激活与浮现、重整之间的相互作用，以及自我强化的抑制。
- 这些是 YUVI 自己的机制，在评测台上比较。

## 5. E　后台整理、重整与任务生命周期

| 候选 | 状态 | 不选的理由 |
| --- | --- | --- |
| BullMQ | 需要 Redis | 第二个存储 |
| pg-boss | 需要 PostgreSQL | 同上 |
| liteque（MIT；0.10.0） | 依赖 better-sqlite3、drizzle-orm、zod；自己的 SQLite 任务表 | 第二套运行状态，与档案分离 |
| plainjob | 0.0.14，2024 年后无发布 | 维护不足 |
| croner（MIT，零依赖） | cron 表达式调度 | 目前只需要“空闲多久后做”，现有 `setInterval` 已满足 |
| p-queue（MIT） | 进程内并发队列 | 目前只有一条串行队列，现有 Promise 链已满足 |

**结论：** 继续使用 P4 的机制：

- 一条串行队列；
- 空闲计时器只负责排队；
- 持久状态全部来自档案（`inner/wrote`、`control/unconsolidated` 已经是“任务做到了哪里”的记录）；
- 失败有上限、如实入档。

重整（WP-F）复用同一机制。引入任务框架会制造一份与档案不一致的可能，而单实例下它没有要解决的问题。

**重新评估的条件：** 出现多种需要并发与优先级的后台任务（例如嵌入批处理与重整同时进行）时，先考虑进程内的 p-queue，而不是持久化任务库。

## 6. F　评测与可观测性

| 需求 | 选择 |
| --- | --- |
| 测试运行器 | `node:test`（现用）。不换 Vitest：没有它能解决、而我们遇到的问题 |
| 加速时间 | `node:test` 的 `mock.timers.enable({ apis: ['Date', 'setInterval', 'setTimeout'] })`。探针验证：一次 `tick` 推进 7 天，`Date` 与计时器同步（[probes/clock.test.mjs](probes/clock.test.mjs)） |
| 假模型 | 现有测试中的本地 HTTP 假模型服务（`test/p4.test.mjs`），扩展即可 |
| 轨迹 | 档案本身，加上 WP-B 的呈现记录与 P2 的用量记录；一次生成的输入可以完整复原，不需要 OpenTelemetry 或 Langfuse |
| 真实模型对照实验 | 小脚本：按脚本驱动 → 读档案 → 输出指标 JSON。promptfoo（MIT，0.124.1，约 76 个直接依赖）适合大量提示的并列评测，目前不需要；出现这种需求时再引入，且只作开发依赖 |

**结论：** 评测不建平台。每个机制的工作包附带它需要的合成生活脚本和统计查询（WP-D 只提供最小的共用部分）。

## 7. 新负担与取舍

| 选择 | 带来的负担 | 换来的 |
| --- | --- | --- |
| 继续 `node:sqlite` | 跟随 Node 版本；在 Node 22 EOL 前升 Node 24 | 无原生依赖 |
| FTS5 + 自己的切分 | 切分规则有版本，改动要重建索引 | 中文可用，无外部依赖 |
| 以后的本地嵌入进程 | 多一个进程与模型文件，需要部署与监控 | 换说法、跨语言检索；隐私留在本机 |
| 暴力余弦 | 规模变大后要换 `sqlite-vec` | 现在不引入预 1.0 的原生扩展 |
| 不用任务框架 | 后台任务种类变多时要重新评估 | 只有一份运行状态 |
