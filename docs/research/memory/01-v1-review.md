# 01　V1 记忆研究回顾：理论、工程与实际路径

> 2026-10-21，Claude。只读调查：V1 仓库文档与代码、未合并分支、PR 记录，以及 YUVI_NEXT P1–P4 的代码与验收记录。没有运行真实模型，没有访问 Alice 或 Yuvi 的私人数据。
>
> 本文描述 V1 时使用 V1 自己的词汇（Mem0、Profile、Dream、Authority 等），只为准确指称历史对象；它们不进入 V2 的概念或模块名（[TERMS §3](../../TERMS.md)）。

## 0. 版本与证据的口径

V1 的“记忆系统”在不同位置有不同的真实程度。下文每条结论都标注它属于哪一种。

| 口径 | 指什么 | 引用基准 |
| --- | --- | --- |
| **main** | V1 `main`，桌面/网页实际可用的版本 | [`0d894cc7`](https://github.com/Ruichen-0079/YUVI/tree/0d894cc70d42ebba0df132924f5ea181c062b431) |
| **运行中** | Alice 实际运行的版本：Plunge 分支（QQ），release checkout 的 Git 元数据为 `5064c29`；**没有已验证的活跃进程构建证明** | [集成计划“当前 Alice 版本”一行](https://github.com/Ruichen-0079/YUVI/blob/a1b894233767827a714dc19c13456f088da982ae/docs/research/evidence-truthfulness/integration.zh.md) |
| **R4/R5 堆叠** | PR #322–#337，未合并、未部署；迁移 026–045 | 堆叠顶端 `fix/r5-crash-ownership` [`a1b89423`](https://github.com/Ruichen-0079/YUVI/tree/a1b894233767827a714dc19c13456f088da982ae) |
| **只在文档** | 设计、契约或研究报告，没有生产实现 | 各文档链接 |

下文把 V1 仓库中的路径简写为 `main:路径`（指 `0d894cc7`）和 `R5:路径`（指 `a1b89423`）。

## 1. 理论的演化

### 1.1 时间线

日期依据项目史重建（[YUVI PR #338](https://github.com/Ruichen-0079/YUVI/pull/338)，`docs/research/project-history/PROJECT_HISTORY.md`）；V1 `main` 中这些文件的首次提交日期多为 09-25，不反映写作时间。

| 时期（2026） | 记忆被理解为 | 代表文档 | 落成机制了吗 |
| --- | --- | --- | --- |
| 05-10 — 06-22 | **伴侣对用户的了解。** `AGENTS.md` 规定“记忆不能是原始聊天记录”“必须检索、排序、压缩、重构后再注入”。05-15 — 05-27 做成用户画像事实库：类型（working/episodic/semantic/emotional/procedural）、层级（core/recall/archival/working）、状态、时间字段、按类别保留期 | `main:docs/memory.md` | 是（PG `memories`、pg_trgm、FTS、pgvector；抽取；保留期；关键词情绪标签） |
| 08-02 — 08-15 | **外部记忆库与“记忆是证据”。** 接入 Mem0 sidecar；08-11 的 PR #9 引入 `MemoryEvent` 证据模型并写下“Memory stores evidence about what happened. It does not authoritatively mutate Relationship, Affect, Persona…”，同时关闭 `infer=true` | `main:docs/mem0-memory-foundation.md`；PR #9 | 是；Mem0 此后只剩向量存取 |
| 08-29 — 08-31 | **分层上下文与证据→解释。** L0 直接上下文（6 轮/6000 字）、L1 近期情节（30 分钟切段、7 天）、L2 证据；Dream 整合；联想闯入；压缩原语；外部库对比（RecMem/memU 借鉴，Mem0 v3、Zep/Graphiti、MemOS 拒绝）（#143）。P8 身份/人格/关系：证据与解释分离 | `main:docs/memory-vnext.md`；`main:docs/future/01-p8-identity-persona-relationship.md` | 部分：L0/L1/L2 运行；**Dream 从未被空闲时钟触发；联想闯入只作上下文、未评估；P8 没有任何产生解释的部分** |
| 09-12 | **第一次点名记忆动力学：** v0.1.3 计划把“reinforcement, decay, recurrence dynamics, importance-preserving forgetting”列为地基完成后的研究 | 提交 `e4d90d7b` | **否** |
| 09-19 | **生活实感。** “Yuvi should not repeatedly query her life. She should live inside it.”；过去即使原话想不起来也应改变未来；时间印象；人格惯性的多时间尺度；跨可替换机械的连续；“机械基底精确，心智界面经验化” | `main:docs/future/00-artificial-person-north-star.md`（L29、L136、L326） | **否**，全部停在理论 |
| 09-22 — 10-07 | **可归因的经历。** Journal（回执/意图/尝试/结果/派生/修订）、来源谱系、`MemoryLineageV1`、Profile 物化 | `main:docs/future/life-event-journal.md`、`memory-and-lineage.md`、`a10.1-grounded-memory-roadmap.md` | Journal 与谱系是；**Profile 物化没有读方；关系解释没有生产者（UNKNOWN）** |
| 09-24 | **因果连续、最小充分架构**；不强制潜在自我。同期：测量整合（切段 → 不知状态的封闭标签标注 → 确定性积分 → 投影；“任何持久变量先有测量定义”；不设心理标量）、前瞻连续性（承诺/期待/意图/未结话题）、研究方法（E1–E8、轨迹生成与重放、选择研究门槛、换模型四轴） | `main:docs/future/north-star.md`、`measured-consolidation.md`、`prospective-continuity.md`、`research-methodology.md`、`selection-research.md`、`model-replacement.md` | 否；方法停在文档，实验设施未建 |
| 10-09 | **审计：生产中记忆没有真正起作用。** 持久内部状态的六条路线（富历史重建、动态文本状态、显式动力学、学习的潜在状态、测试时记忆参数、混合） | `main:docs/research/production-intelligence-loss/`、`backend-intelligence-value/`、`persistent-internal-state/` | 审计与报告 |
| 10-10 — 10-19 | **模型给语义，程序管权限。** R4 真实 LLM 抽取 + 逐字证据；R5 自建 PostgreSQL 记忆权威，取代 Mem0 | `R5:docs/research/runtime-intelligence-r4/`、`runtime-memory-r5/` 等 | 是，但**未合并、未部署** |
| 10-20 | **档案 ≠ 记忆**；回忆是重建；潜在组织 | [V2 蓝图（YUVI PR #339）](https://github.com/Ruichen-0079/YUVI/pull/339) | 由 V2 承接 |

### 1.2 被推翻的判断

| 早期判断 | 后来 | 证据 |
| --- | --- | --- |
| 记忆不能是原始聊天记录 | 原文是一切的基础；但原文不是记忆（V2 N11） | V2 蓝图 §1.4、N11 |
| 助手的话永远不是长期记忆来源 | YUVI 自己说过、选择过、怎么看一件事都没有进入长期记忆 → 它没有自传 | `main:packages/memory/src/ingestion.ts` L46 的注释；V2 蓝图 §1.1 |
| 普通日常事件默认拒绝，明确要求记住也只保留约 7 天 | 与“岁月感”“生活实感”直接冲突；日常正是生活史的材料 | `main:docs/memory.md` L309、L343 |
| 沉默不留痕 | V2 中沉默是行为（`act/silent`） | `main:packages/core/src/runtime-orchestrator.ts` L2301 附近 |
| 外部记忆库能承担长期记忆 | Mem0 推理一周后关闭；R5 用自建权威取代 | `main:docs/mem0-memory-foundation.md`；`R5:docs/research/runtime-memory-r5/README.zh.md` |
| 关键词规则可以抽取、标注情绪、识别“忘记” | “Don't forget” 被识别成删除请求；抽取在 LLM 与规则之间反复切换（05-17 默认 LLM → 09-08 默认规则），R5 明确禁止规则兜底 | `main:docs/research/production-intelligence-loss/`（F3）；`main:packages/core/src/runtime-orchestrator.ts` L3715–3724；R5 语义任务“无规则兜底” |
| 向量检索是默认的语义召回 | 已知事实覆盖：词项 10/10，向量 6/10，原融合 3/10 | `R5:docs/research/compositional-retrieval/README.zh.md` |
| 更正必须由程序保证生效（R4/R5“当前知识”） | V2 决定（a）：更正是经历，采纳由它自己；可信边界由程序确定 | [ROADMAP §2.2](../../ROADMAP.md) |

### 1.3 哪些概念真正有过实现

- **成为机制的：** 存取（存储、索引、召回、排序）、来源（谁说的、哪条原文）、更正的历史关系（supersedes/conflicts/supports）、失败的诚实状态（UNKNOWN、PARTIAL）、恢复。
- **始终停在理论的：** 记忆的**动力学**。强化、衰减、复现、保留重要性的遗忘、时间印象、人格惯性、整合的测量、前瞻条目。
- **运行过却从未评估的：** 联想闯入（main 中作为提示记忆进入上下文，`main:packages/core/src/runtime-orchestrator.ts` L3764；没有任何效果测量）。它的衰减按记忆的年龄分段计算（`main:packages/memory/src/associative-recall.ts` L233），冷却只记在进程内存中（`runtime-orchestrator.ts` L367）。

V1 没有任何一条运行中的路径会因为一段记忆被想起，而改变它以后被想起的可能。

这是 V1 最重要的一条事实：**它把存取做到了很高的可靠性，而“记忆在经历中演化”从未发生过。**

## 2. 工程的演化

### 2.1 存储模型的四代

| 代 | 模型 | 生命周期 | 后来怎样 |
| --- | --- | --- | --- |
| ① PG `memories` / `entities` / `relations`（迁移 001–010） | 一条记忆 = 一行，带类型、层级、状态、时间、重要性；Qwen3-Embedding-0.6B，MRL 512 维 | 规则/LLM 抽取 → 打分 → 保留期 → 检索时排序（关键词、类型、层级、重要性、新近、访问新近、来源、范围） | 仍在 main；排序字段多数来自程序判断 |
| ② Mem0 sidecar | 向量库 + 可选 LLM 推理合并 | `infer=false` 后只做存取；最终化摄取账本（CAS、租约、最多 8 次投递） | R5 中退为兼容后端 |
| ③ Journal + 谱系（013） | 不可变事件包络 + 可擦除正文；来源去重；派生关系 | 回执/意图/尝试/结果/决定/派生/修订 | 成为 R5 的来源基础 |
| ④ R5 权威（026–045） | 只追加的命题记录 + 接纳 + 关系（supersedes/conflicts/supports）+ 范围版本/水位 + 可重建当前投影（代际、影子重建）+ 语义任务队列 + 索引 outbox + 向量 + 词项倒排 + 检索运行记录 | 用户输入在入口同事务入 Journal 与摄取决定；持久 Worker 调模型提出命题（必须引用原文的唯一连续子串）；程序校验来源、权限、关系后提交；索引异步 | 未合并 |

R5 的分工写在提示里：“You decide semantics, not permissions.”（`R5:packages/memory/src/authority/semantic-policy.ts` L304）。模型提出命题和关系，程序校验引文、主体、受众、关系目标，不做语义判断。这是 V1 后期最清楚、最值得继承的一条分工原则。

但 R5 的命题是**关于用户的第三人称事实**：同一提示要求“User assertions are self reports”，保留“facts, preferences, goals, decisions, unresolved issues”。它把语义交给了模型，记忆的对象却没有变：仍然是“伴侣对用户的了解”，而不是“这个个体自己的过去”。

### 2.2 实测有效的工程

| 成果 | 实测 | 来源 |
| --- | --- | --- |
| 自然更正在重启后生效 | R4：3/3；约 120 次调用约 $0.006 | `R5:docs/research/runtime-intelligence-r4/README.zh.md` |
| 规模与延迟 | 1M 历史分页 p95 约 1–2 ms；文本约 30 ms；1M 合成向量 HNSW p95 13.6 ms（修正 `ef_search` 后）；在线 1M 影子重建 48 s；向量存储约 5.97 GB/1M | `R5:docs/research/runtime-memory-r5/performance.zh.md` |
| 组合检索 | 每个问题拆成 ≤5 个需求，每个需求带原句引文；已知事实覆盖 10/10（向量 6/10，原混合 3/10）；精度约 0.52 | `R5:docs/research/compositional-retrieval/README.zh.md` |
| 证据支持判断 | 完整答案正确 12/24 → 19/24；无依据回答 4/11 → 1/11；有效证据误拒 3/13 | `R5:docs/research/evidence-truthfulness/README.zh.md` |
| 逐字引文校验 | 拦下模型把 `4A87` 抄成 `4A88` | `R5:docs/research/compositional-retrieval/` |
| 先排序再截断 | 旧读取器在 `ts_rank` 之前物化无序 `LIMIT 513`，相关记录在排序前消失；修正后三个常见词 + 标识 Recall@8 0/3 → 3/3 | `R5:docs/research/durable-observation-retrieval/retrieval.zh.md` |
| 派生索引的生命周期 | 代际、水位、`VERIFY` 检出人为删除、分批 `REBUILD/ADVANCE` 恢复、备份恢复后计数与摘要一致 | `R5:docs/research/evidence-truthfulness/index-reliability.zh.md` |
| 冷恢复 | Debian 12 新 VM 首装、完整停机备份、另一台 VM 恢复并继续使用；旧点在新写入后拒绝复用 | `R5:docs/research/r5-release-candidate/README.zh.md` |
| 结果未知不重做 | SIGKILL 后保留未决派发，不伪造 APPLIED，不重试外部动作 | 同上；`durable-observation-retrieval/README.zh.md` |

### 2.3 实测失败或未关闭的工程

| 问题 | 实测 | 来源 |
| --- | --- | --- |
| 双命题更正部分失败 | “现在用露川-4A87，栀子-613 已经无效”：两条命题都指向同一旧命题；一条提交后，另一条的重评要求必须有关系，模型三次判为 `new` → 重评耗尽 → 8 次投递后 `RETRY_EXHAUSTED`，留下 1 成 1 败 | `R5:docs/research/evidence-truthfulness/formation.zh.md` |
| 高频旧事实召回 | 每词 33 条倒排的读取器漏掉最早的 current 记录（`candidateLimited=true`） | `index-reliability.zh.md` |
| 长中文尾部 | 约 1623 字的命题产生 512 条倒排，尾部标识未召回 | 同上 |
| 跨语言与分词 | 英文 `editor` 不匹配中文“编辑器”；“喜欢的茶”与“茶叶偏好”的二元组不重合；组合问题三轮 2/3、3/3、2/3 | `retrieval.zh.md` |
| 模型复制先前引文 | 摄取英文自述时，模型把 prior 中三条中文事实当作当前来源引文；接纳层全部拒绝 | 同上 |
| 写入失败时的口头承诺 | 写入失败，模型仍说“已记下” | `runtime-intelligence-r4/README.zh.md` |
| 回退不可行 | 033 之后旧 runner 无法在新 schema 上运行（`42809`） | `evidence-truthfulness/integration.zh.md` |
| 未关闭门槛 | 旧资产迁移、持续来源审计、全域隐私删除、`/message` 的 Host 身份、模型空间升级、长期质量、Supervisor 崩溃自动恢复 | `runtime-memory-r5/open-gates.zh.md`；`r5-release-candidate/README.zh.md` |

**规模代价。** `main` 的 `packages/memory/src` 非测试代码约 26,200 行；R5 顶端约 31,800 行（87 个文件改动，+9,578/−567），再加 20 个迁移。这些代码的绝大部分在处理存取的正确性。

### 2.4 哪些设计解决了真问题，哪些只是移动了复杂性

**解决了真问题：**

- 原文入档与入口同事务：消除“回复失败就不学习”。
- 逐字引文约束：消除伪造归属（A10.1a 的缺陷曾由测试复现）。
- 可重建的派生索引、代际与校验：索引损坏可以检出并修复，不动历史。
- 先排序后截断、各通道独立失败、`PARTIAL ≠ 空`：检索不再“静默地少”。
- UNKNOWN 不重做：外部动作不会被恢复逻辑重复执行。

**把复杂性从一处移到另一处：**

- **当前知识投影 + 关系重评。** 为了让“更正生效”成为程序保证，必须由程序维护“哪条是当前的”。于是每一个语义关系都要变成可校验的结构，模型稍有不同的判断（`new` 而不是 `supersedes`）就成为写入失败。复杂性从“模型理解错”移到“结构不接受模型的理解”。
- **检索前的语义规划与支持判断。** 查询规划、证据支持各是一次独立的模型调用和一套独立契约，用来弥补“检索选错了”。这些判断本可由回答者自己在工具循环中做；它们成了程序侧的又一层语义中间层。
- **Profile、P8、Dream。** 每一个都有自己的存储、生命周期和契约，却没有消费者或生产者。

### 2.5 程序维护的可核验状态与程序定义的主观认知

V1 后期的设计有时把这两类东西混在一起：

- **程序维护、可以核验的状态：** 谁说的、何时、在哪、对谁可见、哪条原文、是否送达、执行是否发生、索引是否与历史一致。这些由程序负责是对的，V2 继续这样做。
- **程序定义的主观认知权威：** “哪一条是用户当前的偏好”“这条记忆的重要性”“这次对话的情绪”“这段经历值不值得保留”。V1 早期由规则直接给出；R5 改由模型给出，但仍由程序把模型的一次判断**固化为全局唯一的当前状态**，并要求后续判断与之保持结构一致。

V2 的区分（见 [03 §1](03-architecture.md)）就是从这里来的：程序拥有前一类；后一类属于个体自己，可以变化，可以错，不能被程序固化成权威。

## 3. 实际进入模型的路径（V1 main 与运行中版本）

### 3.1 一次回合

来源：`main:docs/research/production-intelligence-loss/`（F1–F7 编号出自此处）、`main:docs/research/backend-completeness-audit/`、`main:docs/research/backend-intelligence-value/`，以及 V2 蓝图 §1.1 所引代码行；PR #323 的修正只在 R4/R5 堆叠中。

```
用户消息
  → Journal 回执 → Conversation
  → [Mem0 模式] 关键词检测“忘记”请求 → 检索前删除 Mem0 记忆           (F3)
  → DirectContext（近 6 轮 / 6000 字） + L1 近期情节（只含用户）
    + L2 检索（与当前文本相似） + P8 人格（关系 UNKNOWN）
  → 规范化分段（A4） → 压缩：工作窗口 min(24,576, 0.75×窗口) token      (context-compression.ts L173)
  → Gate 调用（JSON：回不回、怎么回） → Body 调用（正文）；启用 Cognition 时 N+3 次调用
  → 输出 8000 字上限；finish_reason=length 整体拒绝；对外发布截断到 800 字   (#323)
  → 沉默：直接返回，不存助手消息，不写记忆                               (runtime-orchestrator.ts L2301)
  → 否则从“用户”的话里抽取记忆（规则；名义上 MEMORY_EXTRACTOR=llm，实际规则兜底）
```

运行中的 QQ（Plunge 分支，未合并）还有入口损失：编码器丢弃 @ 与回复段，图片变成 `[Image attachment]`，显示名不入 Journal；群场景观察窗口 12 条/120 秒/512 字。

### 3.2 信息在哪里被裁剪、解释或丢弃

| 位置 | 发生了什么 | 类型 |
| --- | --- | --- |
| 入口编码（QQ） | @、回复关系、图片、显示名丢失 | 来源损失 |
| 抽取 | 只抽用户；日常事件默认拒绝；规则兜底 | 程序预先解释 |
| “忘记”检测 | 关键词误判为删除 | 程序预先解释 |
| 保留期 | 按类别过期 | 程序预先解释 |
| L1 | 不含助手 | 对象错误 |
| 压缩与上下文封顶 | 无论模型窗口多大，封顶 24,576 token | 管道裁剪 |
| Gate JSON | 回复意图被压成结构字段 | 中间层 |
| 输出 | `length` 整体拒绝、800 字截断 | 管道裁剪 |
| 沉默 | 不留痕 | 对象错误 |

### 3.3 生成了却没有消费者的东西

- **Profile 物化**：有生产，没有读方（`main:docs/future/a10.1f-profile-materialization-contract.md`）。
- **P8 关系**：有读方，没有意义生产者，长期 UNKNOWN。
- **Dream 整合**：实现了，没有空闲时钟，从未触发。
- **联想闯入**：进入了上下文，但没有任何评估，不知道它是否有用。
- **压缩原语**：未启用。
- **测量整合、前瞻连续性**：只在文档。

### 3.4 后来修好的与仍在的

- 修好（只在 R4/R5 未合并分支）：用户原话不再依赖助手成功才入长期记忆；更正带历史；检索先排序；`PARTIAL` 诚实；索引可校验重建；冷恢复。
- 仍在（main 与运行中）：对象错误（只记用户）、管道裁剪、Profile/Dream 无消费者、QQ 入口损失。
- 从未存在：任何记忆动力学。

## 4. 判断：成功、失败与未验证

**成功（有实测）：** 来源纪律；可重建的派生索引；词项 + 语义的混合召回工程及其失败模式知识；有界的模型任务生命周期；冷恢复与 UNKNOWN。

**失败（有证据）：**

1. **记忆的对象错了。** 它记的是用户，不是它自己的生活（§1.2、§3.2）。
2. **多个存储、多份部分真相，没有一个统一的记忆过程。** Conversation、Journal、`memories`、Mem0、L1、Profile、P8、Dream、Authority、Observation 各有生命周期；信息到达模型要经过多次有损解释；有的产物没有消费者。
3. **程序预先解释主观认知。** 早期是规则；后期是把模型的一次判断固化为全局当前状态（§2.5）。
4. **在记忆还没有用途之前，追求存取的完整正确性。** 每完成一层就暴露新的正确性缺口；最终没有部署（V2 蓝图 §1.2 已有同样判断）。
5. **动力学没有落点。** 没有一个地方可以让“经历改变记忆的组织”发生，也没有测量它的设施。

**未验证：** 长期质量；任何整合带来的收益；动力学；成本与积压；在真实生活中的连续性。

## 5. 对 V2 的直接启示

1. 存取工程是成熟的，**可以按需重建，不需要整体搬运**：V2 需要的规模比 R5 小一到两个数量级（单实例、单个体），SQLite 可以承担（[03 §6](03-architecture.md)）。
2. V1 的失败几乎都不是“存取不够好”，而是**记什么、谁的、由谁解释、到没到达模型**。V2 的架构必须先回答这四个问题。
3. 动力学必须从一开始就有落点和测量，否则会重演“理论很好、机制为零”。
4. 每个产物在设计时就要写明它的消费者；每次模型调用都要能事后看到它实际读到了什么。
