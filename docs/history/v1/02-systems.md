# 02　V1 的系统架构与各子系统的真实能力

> V1 知识归档的一部分，总索引见 [README](README.md)。状态分类的定义见 [README §状态分类](README.md#状态分类)。
>
> - **来源缩写：**
>   - **M** = V1 `main` @ `0d894cc7`；
>   - **R5** = 未合并堆叠顶端 `fix/r5-crash-ownership` @ `a1b89423`（PR #322–#337）；
>   - **P** = 未合并的 Plunge 分支 `feat/plunge-webui-20261008` @ `adff0c70`；
>   - **D** = 10 月日常安装所用的构建 `5064c29f`（见 §0）；
>   - **IDX** = PR 研究索引 `PR_RESEARCH_INDEX.md` @ `3f6a9393`，其中 B/C/D 是该索引对 PR 的归类（B 已验证工程，C 未验证或未接线，D 被取代）。
> - **调查方式：** 只读源码、文档、测试与 CI 记录，没有打开任何数据、日志、`.env`、数据库或聊天记录。
> - **记忆子系统：** 在 [`docs/research/memory/01-v1-review.md`](../../research/memory/01-v1-review.md) 中已有详细回顾，本文只给摘要和指针。

## 0. 先看部署：V1 实际运行的是哪个版本

**结论：** V1 `main` 上的大部分后期工程（09-08 之后）从未进入负责人日常使用的安装包。

**实测（本归档调查）：**

- R5 分支上的三份文档记录，10-10、10-11 两次只读核对时，日常运行的安装包 manifest 与 release checkout 都指向 `5064c29fa85da959b6a5b29a1655bfdadb2a6a3d`。这三份文档是 `runtime-model-value/README.zh.md`、`runtime-intelligence-r4/README.zh.md` 和 `runtime-memory-r5/phase2.zh.md`。
- 在完整克隆中核对：
  - `5064c29f`（09-08，“fix(linux): load YUVI_RUNTIME_ENV_DIR in packaged Supervisor”）是 `main` 的祖先；
  - 它包含 PR #279 及以前的合并，不包含 #280 之后的任何 PR；
  - 它有 `services/local-stt`、`services/dots-tts`、`services/memory-mem0`，以及 `packages/p8`、`character-abi`、`character-harness`、`cognition`；
  - 它没有 `packages/effects`、Journal、`canonical-context.ts`、`cognition-production.ts`、`character-scope.ts`。

**含义：** 下表中，凡是来自以下工作的能力，在实际使用层面都只能算“已测未部署”：

- PR #283（09-08 生产语义接线）及其后；
- PR #317（09-12 gate + 正文流式）；
- 10-07 快进并入的 A0–A12 地基，包括 Journal、effect 账本、证据血缘和多角色。

**未核实：** 10-11 之后是否换过部署版本。

**例外：** Plunge 分支在 10-07、10-08 用真实 QQ 账号做过实机试运行（P 的验证文档），但 10-10 的核对没有发现 QQ 入口在运行。

## 1. 总体架构（M）

```
Tauri 桌面壳（Rust，托盘，凭据）
  └─ DesktopSupervisor（Node，进程组，/v1/shutdown）
       ├─ Runtime Server（apps/server：HTTP/SSE/WS，Character 运行时）
       │    └─ packages/core runtime-orchestrator.ts（约 8,100 行的单体编排）
       │         ├─ providers（chat / reasoning / proactive / embedding / vision / stt / tts 路由）
       │         ├─ memory（Conversation、L0/L1/L2、Mem0 适配、Dream、联想侵入、情绪关键词）
       │         ├─ prompt-builder（规范化分段上下文、稳定前缀）
       │         ├─ p8（身份 / 人格 / 关系 / 纠正）
       │         ├─ cognition（能力循环）
       │         └─ effects / journal（A8/A9：接收凭证、意图 → 尝试 → 结果）
       ├─ PostgreSQL 16 + pgvector（应用自管进程）
       ├─ Mem0 sidecar（Python，PyInstaller）
       ├─ local-stt（Python，sherpa-onnx，:9876）
       └─ dots-tts（Python，GPU，:9881，只在负责人私有部署中）
Web UI（React，Live2D）
```

**规模：** 16 个包、25 个迁移、源码约 27 万行（其中测试约 11 万行）。R5 顶端有 45 个迁移、约 30 万行。增长过程见 [03 §2.7](03-engineering-lessons.md#27-复杂度的增长)。

## 2. 运行时与消息处理

| 能力 | 状态 | 机制要点 | 证据 | V2 |
| --- | --- | --- | --- | --- |
| Runtime 编排 | 已测未部署（D 中是更早的简化版） | 接收凭证 → 写入用户消息 → 恢复历史和记忆（近 6 轮 / 6000 字）→ 组装 → Character → 可选 Cognition → 正文 → 发布与写回。每个会话一个 execution owner，新回合会中止旧回合，提交前检查 owner | M `runtime-orchestrator.ts`；`docs/validation/v0.1.3-a2-bounded-loop.md` | 重新设计。保留取消与 owner 检查，不保留单体和“程序先于模型解释语义” |
| Provider 路由 | 实际使用（单路由） | 按能力配置 chain。默认 DeepSeek 负责 chat/reasoning；也有 openai-compatible、NVIDIA、本地；xAI、DashScope 适配器仍在。整条流 30 s wall-clock 超时 | M `packages/providers/src/registry.ts`（3,695 行） | 已采用：V2 只有一个 OpenAI 兼容的流式请求入口 |
| Fallback 判定 | 已测未部署 | 只有 `effectState=not_started` 且没有可见输出时才切换。429、超时、5xx 默认 `unknown`，因此不切换。D 中的条件更宽 | M `types/errors.ts` L190–277；A9.3 提交 `d1d8b090` | 可复用这套判定；要补对 429/5xx 的显式降级 |
| Character 单次 JSON 决策 | 实际使用（D）→ 已取代 | 一次调用返回 JSON：RESPOND（正文在 `text` 字段）/ SILENCE / TERMINATE / NEED_COGNITION，可附 proactive 提案和 `visualNeed` | D `apps/server/src/character-runtime.ts` | 不采用 |
| Gate + 流式正文（两次调用） | 已测未部署 | gate 只返回 JSON；RESPOND 后再用同一份上下文流式生成正文：上限 8,000 字，`length` 整体失败，addressing 硬编码为 `DIRECTED_TO_YUVI` | PR #317（`334ccd4b`）；`docs/character-response-streaming.md` | 不照搬。R5 实测（DeepSeek-V4-Flash，n=3）：关掉 gate 后三项质量相同，调用次数和输入 token 约减半 |
| Character ABI / Harness | 已测未部署，部分停用 | 为假想的后训练 Character 模型准备的决策合同与监督（n-gram 重复检测、恢复）。`recovery-supervisor.ts` 没有生产 import | PR #100–#115（IDX C）；#115 | 不采用 |
| 规范化上下文与稳定前缀（A4/A5） | 已测未部署 | 唯一组装入口。把 IDENTITY/PERSONA/协议放在稳定前缀，时间放最后 | M `packages/prompt-builder/src/canonical-context.ts`；Campaign H 实测 24 个请求的缓存命中率 15.89% → 66.73% | 稳定前缀与缓存计量可复用；历史投影要重新设计（V2 自 P4 起给线性原文） |
| 历史投影与截断 | 实际使用 → 未合并修复 | 历史逐行截到 800 字；`length` 整体拒绝；SSE 心跳 `: ping` 被当作协议错误 | PR #323（R5）：0/3 → 3/3，心跳修复 18/3 → 21/0 | 教训已继承：原文进入上下文，传输 keep-alive 不是错误，部分产出诚实保留 |
| Cognition 能力循环 | 已测未部署 | 自定义文本协议（COMPLETE / REQUEST_CAPABILITY / CONTINUE），不是原生 tool calling。默认 4 轮推理 / 2 次能力 / 60 s。唯一本地能力是授权后的 `read_text_file`，observation 上限 16,000 字 | M `packages/cognition/src/interaction-round.ts`；生产智能损失审计 F4：CONTINUE 不累积进展；R5 实测 DeepSeek Chat 0/4 主动请求能力，GLM Reasoning 3/3 | 重新设计：原生工具协议 |
| 流式、SSE 与取消 | 已测未部署 | 客户端断开即中止整轮；出现可见输出后标记 committed，不再 fallback；区分调用方取消与超时 | M `routes/message-stream.ts`、`transport-abort.ts` | 可复用。另有两个缺陷：WS 把字符串 `"false"` 解析为 true；一条无效事件会清掉已有订阅（完整性审计 E2/E4） |
| Effect 账本（A9） | 已测未部署 | 8 类效果；原子写入意图 outbox；attempt 带 fence/lease；只在 `PROVEN_NOT_APPLIED` 时重试；每个非空 delta 一次事务；必须有 PostgreSQL | M `packages/effects`；`docs/validation/v0.1.3-a9.*` | 概念已继承（不变量 5），但只用于对外效果，不覆盖每个 delta |
| Journal 接收凭证（A8） | 已测未部署 | 所有入口先写接收凭证；没有 `DATABASE_URL` 时返回 503 | M `PostgresJournalRepository`；`docs/future/a8.2-ingress-closure.md` | 已继承：V2 只追加档案 |
| 进程内事件总线 | 实际使用 | `InMemoryEventBus`；`EVENT_BUS=nats` 会直接抛错 | M `apps/server/src/context.ts` L231 | 进程内足够 |
| 错误被映射成正常结果 | 实际使用（缺陷） | 删除失败写成 `notFound`；分类失败写成 `NONE` 再变成沉默；写入失败时模型仍说“已记下” | 生产智能损失审计 F3/F6；R4 文档 | 教训已继承：FAILED、NOT_FOUND、NONE 是三种不同状态 |

**本领域的教训：**

- 多处局部合同各自正确，组合起来却丢失信息。
- `NODE_ENV=test` 时根本不装配 Character（M `apps/server/src/context.ts` L507–510），测试因此系统性地漏掉生产差异，直到 #327 才修正。
- 为补偿模型弱点建立的结构（双模型主动路径、gate），在换模型后没有重新验证。

## 3. QQ 与社交表面

| 能力 | 状态 | 机制要点 | 证据 | V2 |
| --- | --- | --- | --- | --- |
| 旧 QQBot 插件（ZIP） | 已取代 | 把 PERSONA 整段替换为“QQBot…with your own social memory”；另有一套群聊记忆；每条群消息当作一个用户回合 | P `docs/validation/plunge-local-audit-2026-10-07.md`（把这些行为标为 DELETE）；构建提交 `7dcf4b01`、`e8a09719`、`dbb4b984` 公开不可达 | 不采用 |
| SnowLuma 源码合同（A12.1） | 仅设计 | OneBot `message_id` 是 SHA-1 截成的 int32，实测同群碰撞，不能当去重身份；普通消息无去重、重连不重放；发送成功只表示网关收到；响应丢失记 UNKNOWN，不重发 | M `docs/future/a12.1-snowluma-contract.md`（“LIVE PROBE PENDING”） | 可复用（外部系统事实，锁定 SnowLuma `0591b160` / v1.14.19，升级后要重新验证） |
| Plunge 薄适配器 | 未合并（10-07/08 实机试运行） | OneBot WS → 解码 → 频道允许列表 → 全局串行队列（≥16 拒绝）→ Host 绑定身份 → 写接收凭证 → 只有被准入的消息才进入 Runtime。未绑定的发送者没有记忆权限。发送走 A9：ACKNOWLEDGED / UNKNOWN；SILENCE 零发送；FAILED 与 SILENCE 分开 | P `apps/server/src/plunge/*`；真实 PostgreSQL 下集成测试 27 项通过；`plunge-alice-2026-10-07.md` 等验证文档 | 重新设计后可复用：发送确认分层、Host 而非插件掌握身份 |
| 场景观测窗 | 未合并 | 每频道 12 条 / 120 s；旧消息截到 512 字，总预算约 2,700 字。有 surface 时**跳过持久历史**，用这个短暂场景顶替 | 后端智能价值审计 F1；探针：121 s 后场景为空 | 不采用：短场景不能顶替持久、忠实的历史 |
| 入口信息损失 | 未合并 | @ 与回复段从正文删除（位置丢失）；只有第一张图可读；表情/文件/语音只留类型；匿名消息、超过 64 段或 4,096 字的消息直接丢弃且不入 Journal | P `qq-codec.ts` | 教训：入口要保留结构与原文 |
| 准入规则 + 本地 4B 预过滤 | 未合并 | 准入顺序：私聊 > @ > 回复 Alice > 同一发送者 60 s 内续接 > 别名/预过滤。Qwen3.5-4B 预过滤超时或不确定时一律放行 | P `qq-attention.ts`；实机一次 ATTEND 109 ms | 暂无结论：没有对照实验 |
| 当前回合授权分类 | 未合并 | 同一模型先把消息分为 NONE / SOCIAL / TASK / RESUME，正向结果须附原文证据；连续失败后 `?? NONE` 被合成为正常沉默 | P `character-turn-authority.ts`；审计 F6 | 重新设计：“理解后决定不回”与“分类坏了”必须可区分 |
| 线性上下文 v1 | 未合并 | 两条消息：System 放控制、身份、关系、回忆；User 放按时间排列、带作者的观测与当前原文。用 `[SELF_SENT: ACKNOWLEDGED]`、`[SELF_DRAFT: publication UNKNOWN]`、`[QUOTE: …]`、`[PERCEPTION: …]` 区分来源 | P 提交 `734e1e12`；一个样本 9,885 → 4,642 字符；多数呼唤判断正确，旁听插话仍不稳定 | 原则已继承：V2 自 P4 起的线性原文组装 |
| 管理 WebUI | 未合并 | 本机管理页：Bearer 令牌、同源检查、Prompt Inspector | P `4ed96cf5`、`adff0c70` | 不采用（专为 Alice 部署） |

**本领域的教训：**

- 一句提示词声称“有自己的社交记忆”，不能建立任何记忆分区。
- 程序侧的准入与分类让主模型看不到被过滤掉的旁听，也就无法自己判断（[03 §1.2](03-engineering-lessons.md#12-程序替模型理解d7)）。
- 研究归档对社会参与的结论（RESEARCH_FOUNDATIONS P8）是：参与回应的是有锚点、可撤销、会过期的机会，而不是回复压力。这一结论只是设计，未检验。

**私有资产：** Plunge 的验证文档中出现了真实群号、私聊对象与私有目录路径，真人交互的原始请求与日志在私有目录、未入库。本归档只记录它们存在，不收集内容（见 [05 §4](05-sources.md#4-私有或访问受限的资产只记录存在)）。

## 4. 记忆、人物与上下文

**记忆**的四代存储、实际进入模型的路径、实测有效与失败的工程，已在 [`research/memory/01-v1-review.md`](../../research/memory/01-v1-review.md) §2–§4 详述，继承判断在 [`02-inheritance.md`](../../research/memory/02-inheritance.md)。摘要：

| 能力 | 状态 | 要点 |
| --- | --- | --- |
| PG `memories` / L0/L1/L2（Memory vNext，PR #143） | 实际使用 | 规则或 LLM 抽取 → 打分 → 保留期 → 多字段排序。记忆的对象是用户；L1 不含助手的话 |
| Mem0 sidecar | 实际使用 → 已取代 | PR #9 后 `infer=false`，只做存取；有最终化摄取账本 |
| Journal + 证据血缘（A8/A10） | 已测未部署 | 不可变事件包络 + 可擦除正文；派生关系 |
| R5 记忆权威（迁移 026–045） | 未合并 | 模型提出命题（必须引用原文的唯一连续子串），程序校验来源、权限、关系后提交；可重建投影；词项 + 向量混合检索。R4 实测：自然更正重启后生效 3/3 |
| 组合检索、证据支持判断 | 未合并 | 已知事实覆盖 10/10；完整答案 12/24 → 19/24 |

**人物与身份：**

| 能力 | 状态 | 机制要点 | 证据 | V2 |
| --- | --- | --- | --- | --- |
| P8 身份/人格/关系/纠正 | 已测未部署（D 有包，生产接线在 #283 之后）；Plunge 实机执行过纠正 | 身份地址把 `characterInstanceId`、`personaProfileId`、`subjectScopeId` 分开；认知状态词汇表 KNOWN / UNKNOWN / CONFLICTING / PARTIAL / EMPTY / UNAVAILABLE / ERROR；显式纠正存储 | PR #92–#99（IDX C；#96 过早合并后回滚）；#283 | 词汇表可借鉴；关系长期 UNKNOWN，没有意义的生产者 |
| Profile 物化（A10.1f） | 已测未部署 | 有生产，没有读方 | 后端智能价值审计 | 不采用 |
| Product Person 与 native-owner 命令 | 已测未部署；Plunge 实机执行过 | 唯一的 Person 权威，带 revision 围栏；PRODUCT_PERSON / VOICE_BINDING / P8_CORRECTION / ACOUSTIC_PROFILE 命令走意图、锁与原生 owner 回执，结果分 APPLIED / ALREADY_APPLIED / UNKNOWN | M `apps/server/src/services/product-store.ts`、`product-person-command-effects.ts` | 以后可复用（所有者确认 + 回执 + UNKNOWN 可恢复），实现很重 |
| 独立 Character 组合（多角色） | 已测未部署；第二个角色只在 Plunge 部署中使用 | 不可变的 `CharacterBinding`：definition 决定身份与人格，instanceId 决定经历归属。每个组合有独立根目录、PG schema 与单写者锁，外来 memory scope 一律拒绝 | M 提交 `49150e62`；`docs/architecture/multi-character.md`；真实 PG 双 worker + SIGKILL 恢复测试 | 原则可继承：经历按实例归属、不共享记忆。V2 是单个新个体 |
| v0.1.4 People & Profile | 仅设计 | QQ、模型、Mem0 都不能自行建立身份绑定；可披露范围不能扩大；纠正让下游失效 | M `docs/future/10-v0.1.4-people-profile.md` | 仅作参考 |

## 5. 主动性、调度与内在活动

| 能力 | 状态 | 机制要点 | 证据 | V2 |
| --- | --- | --- | --- | --- |
| Runtime 主动调度（Atom 08/10） | 实际使用（D 中为 NO_OP / REQUEST_TEXT 分类版；需用户开启，默认关闭） | `setTimeout` 定时，默认每 60 s 评估一次；未获同意、静默、语音或播放中、显式回合进行中都不唤醒。NO_OP 后退避 30 s，发言后静默 120 s。决策模型默认 Llama-3.3-70B，正文由 Chat 续写 | PR #237/#243（IDX C）；M `runtime-proactive-policy.ts`、`runtime-orchestrator.ts` L1690–1760；`apps/web/src/proactive-consent.ts`（`enabled: false`） | 重新设计。继承：用户同意与静默的持久化；助手发起的回合不伪造用户消息、不写记忆（PR #41，IDX B）；提交前的活动版本号重校验；NO_OP 是合法结果 |
| 说话分数 ≥ 0.7 | 已测未部署 | 用打分取代二分类 | PR #284（IDX C）；`runtime-orchestrator.ts` L3328–3346 | 不采用固定阈值作为主动性来源 |
| 主动决策模型对比（Campaign H） | 实测 | 40 个合成用例 × 2 次。Llama-3.3-70B 66/80（误报 12）；Llama-3.1-8B 52/80（错误 16）；Gemma-3-4B 73/80。最终保留 70B，原文“不声称 12 个误报可接受” | M `docs/future/evidence/campaign-h/proactive-comparison.json` | 教训：没有预注册阈值；样本小 |
| 主动调度绑定 default 会话 | 实际使用（缺陷） | 调度器启动时固定 `sessionId:"default"`，切换会话后仍评估 default 的历史 | 后端智能价值审计 F2 | — |
| P6 Web 端规则主动性 | 已取代 | 语义行为仲裁器（P0–P3、TTL）、空闲 12 s 自动候选、冷却 30 s | PR #31–#55（IDX D） | 不采用 |
| Dream 整合（回合后触发） | 实际使用，效果从未测量 | 每回合后按 Jaccard 复现度与正则 `记住|重要|决定了|remember|important` 触发，复用规则抽取，只保留用户断言 | M `packages/memory/src/dream-consolidation.ts` L595–655；PR #143 | 不采用规则触发；“离线期间的内部变化”留给潜在组织研究重新设计 |
| Dream idle / scheduled 触发 | 已测未部署 | 只有调用方传入 `idleMs` 才走 idle 分支（默认 30 分钟），生产从不传；没有独立 worker；已入队任务在无 executor 时隔天仍 pending | 后端智能价值审计 F6 的探针 | — |
| 联想侵入 | 实际使用，效果从未测量 | 按词元重叠给 L1/L2 候选打分，阈值 0.42，最多 2 条 / 360 字；上一轮侵入过则冷却到 0.75 | M `packages/memory/src/associative-recall.ts`、`hierarchy.ts` L27–30 | 行为目标值得保留（相关旧经历未经询问而浮现）；判定应交给激活或模型（ROADMAP WP-E） |
| 前瞻连续性（承诺/期待/意图/开放线程） | 仅设计 | 四种类型 + 归约器 | M `docs/future/prospective-continuity.md`；`packages` 与 `apps` 中零命中。唯一的近似物是正则 `unresolved` / `taskState` | 继承“生成的承诺只是提议、‘我发了’不等于履约证据”；不采用正则 |
| Life Layer / Mind Layer | 已取代（退役） | 慢速、持续、以非语言为主的底层（稳态、疲劳、情感惯性、好奇、依恋）。09-24 整合列为禁用词汇 | M `docs/future/00-artificial-person-north-star.md`（提交 `4278eb36`）；`docs/future/README.md`；`embodiment.md` | 重新设计：不恢复按心理学命名的变量，但“持续、非语言、不直接暴露给语言层的组织状态”正是 V2 研究对象的前身 |
| 语义呈现（表情 token） | 实际使用 | Character 每轮可以选 `neutral|soft-smile|attentive|thinking|amused|excited|acknowledge-interrupt` 之一 | 约 35 个 PR（#156–#197，IDX C） | 呈现生命周期可复用；表情目录不构成“情感” |

## 6. 情绪、人格与潜在状态研究

| 能力 | 状态 | 机制要点 | 证据 | V2 |
| --- | --- | --- | --- | --- |
| CurrentAffect 关键词情绪 | 实际使用（M 与 D）；退役只在未合并的 PR #322 | 8 条正则规则，带固定 valence / arousal / confidence 和一句提示，注入提示词 | M `packages/memory/src/affect.ts`（提交 `806862c1`，05-26）；实测把“我不担心这个问题”判为 anxious 0.82 并送达模型；退役提交 `c1475dae` 不是 `main` 的祖先（本次核对） | 不采用：程序做语义标注的典型反例 |
| 测量整合（四段式） | 仅设计 | 情节切分 → 不看当前状态的封闭标签局部标注 → 确定性归约 → 只读投影；每个持久变量先有测量定义 | M `docs/future/measured-consolidation.md`；没有代码 | 主路径不采用（依赖封闭标签与模型标注）；暴露与选择日志、机会分母、自生成内容不能作为独立证据，这三项可用于 V2 评测 |
| 研究方法 E1–E8 与对照臂 | 仅设计 | E2 预设门槛：≥120 个情节、2 个模型家族、3 次重复、一致性 ≥ 0.70；对照臂 B0、B0p、B1、B2、B3、O_text、O_selection 等；E7 惯性与合理修订、E8 自身行动与后果（来自已关闭的 PR #321） | M `docs/future/research-methodology.md`、`selection-research.md`、`model-replacement.md` | 继承：预注册、强文本基线、状态交换与消融、风险 R1–R8。E7/E8 可直接作为潜在组织研究的因果实验 |
| 持续内部状态基础研究 | 仅研究文档 | 多时间尺度、可学习的循环组织状态，参与对世界和自身行动后果的预测、调节可塑性，不预设心理坐标。三个强反对：完整重放能重建同样的状态；一个向量可能是多个独立控制器的拼接；意义可能来自双方耦合。只跑过 3 个形式反例 | M `docs/research/persistent-internal-state/`（基线 `c28e5901`）；`experiments/results.json` | 作为理论起点继承；三个反例作为 V2 潜在组织研究的必过检验（[ROADMAP §5](../../ROADMAP.md)“潜在组织”） |
| 行为规范 / 评估 / 偏好数据集 | 仅设计 | 三条轨道、约 30 个 YBE 场景（RESP、STOP、EPI、MEM、TIME、COG、REL、LEAK 等）；没有运行器、夹具或数据集 | PR #204/#206/#207（IDX C） | 场景可作为行为回归的种子 |
| 角色后训练 | 仅设计（延期） | 训练阶段 9–13 延期；为它预建了 ABI 与 Harness | M `docs/future/08-character-post-training.md` | 不采用“为假想模型预建边界”；后训练只作为排在显式机制之后的可选实验 |
| 生产人格提示 | 实际使用 | “校准版”人格（v7–v10） | PR #222（IDX C：校准证据未入库） | 不继承（V2 是新个体） |
| GLM 作为 Cognition 默认模型 | 实际使用（只在 `NEED_COGNITION` 时调用） | — | PR #214/#215/#234（IDX B）；M `apps/desktop/src-tauri/src/config/schema.rs` L51 | 无结论：具体模型选择是历史偶然 |

**本领域总判断：** 研究性机制从未开始运行。

- 主动性由计时器和打分代劳，内部状态被 09-24 的禁令排除（[03 §1.4](03-engineering-lessons.md#14-用规则模拟自主或用禁令排除自主d8)）。
- 唯一跑过的模型行为评测是 Campaign H 的主动性对比。
- RESEARCH_FOUNDATIONS 的 P1、P5、P6、P7 命题都未检验（[04 §1](04-v2-inheritance.md#1-研究命题)）。

## 7. 语音、视觉与多模态

| 能力 | 状态 | 机制要点 | 证据 | V2 |
| --- | --- | --- | --- | --- |
| 本地 STT | 实际使用 | sherpa-onnx，只用 CPU，监听 `127.0.0.1:9876`；SenseVoice ASR（约 239 MB，FunASR Model License v1.1，不是 Apache）+ 3D-Speaker 声纹 + pyannote 分离 + Silero VAD；模型清单固定 sha256、字节数与许可证 | M `services/local-stt/README.md`、`models.manifest.json`；PR #198–#213、#286（IDX B）；Campaign B/G 实机验收 | 以后可复用：HTTP 服务边界与带哈希、许可证的模型清单。没有 STT 延迟实测；Python 测试不在 CI 中 |
| dots TTS | 实际使用（只在负责人私有部署中） | `dots.tts-soar`，bf16、10 steps、固定 seed；先绑端口再加载模型；单并发，其余返回 429；空闲 180 s 后休眠；没有中途取消，只能丢弃结果 | M `services/dots-tts/README.md`；Campaign I：常驻显存约 5.3–6.1 GiB、休眠约 276 MiB；预热后短句约 3.8 s、从休眠恢复约 16.9 s、冷启动 18–31 s；PR #281 从公开包移除 | 服务形态可复用；模型选型无结论（bakeoff 证据不在仓库） |
| GPT-SoVITS、IndexTTS | 已取代 | 早期可打断流式语音；零样本方案被否决 | IDX 阶段 1；`docs/future/atoms/README.md` | 不采用 |
| 声纹身份 | 已测未部署（随 v0.1.2 发行，日常是否录入声纹无证据） | 四层身份严格分开：说话人聚类 / 声纹档案 / Person / 显示名。只接受可信控制者的绑定；低于阈值返回 NO_MATCH；HTTP 接口从不返回 embedding；存储为代际文件 + fsync + 原子激活，权限 0600 | Atom 13（PR #249/#250，IDX B）；Astra5 用 LibriSpeech 在 Debian 包中做了真实验收 | 四层分离原则继承；实现以后可复用。真实声纹属于需要负责人批准的真实数据 |
| STT 观测 ≠ 用户消息 | 实际使用 | 转写是观测，引入捕获纪元与实时 VAD | Atom 09（PR #233/#239/#241，IDX B） | 继承（V2 场景与作者分开） |
| 语音模式与打断 | 已测未部署（人工验收未记录完成） | 端点：完整句 650 ms、普通静音 1,200 ms、未完成思路 2,200 ms、硬上限 3,000 ms；预录 400 ms；声学起音触发打断；只把确认已播放的内容发布到字幕 | PR #251/#272（IDX B）；`campaign-d-closure.md`：真实模型门控 3 次重复各提交 3 回合，“One consolidated human check remains” | 以后可复用，端点常数可作为起点 |
| 按需截屏 grounding | 已测未部署（VLM 实测被跳过） | `visualNeed` 触发后每回合只截一次屏、调一次 Vision；截屏 10 s、单图 20 MiB、总 45 s；截图不入库，回合标记 `memoryEphemeral` | `docs/future/campaign-e-visual-grounding.md`；PR #273（IDX B） | 继承“一次性、按需、不常驻 VLM、不周期截图”的原则（PR #260） |
| R5 真实视觉实验 | 未合并 | Qwen3-VL-30B + DeepSeek-V4-Flash，2 张合成图、26 次调用，估算 $0.0036；重启后仍答对；删除后回答不可用；第一轮把柱子大小说反（视觉报告本身正确） | R5 `docs/research/durable-observation-retrieval/vision.zh.md` | 小样本，无普遍准确率结论 |
| 观测留存 | 未合并 | 报告与回执同事务写入，带 TTL 与 tombstone，默认关闭 | R5 PR #329–#333 | 暂无结论 |
| Live2D | 已测未部署（“one human visual pass remains”） | 7 种语义表情；动作合成有硬边界；嘴部开合由音频包络独占；VTS ZIP 导入有校验与路径穿越防护 | `docs/future/campaign-f-presentation.md`；PR #296/#305/#318 | 渲染以后可复用；“Avatar 是否必要”无结论 |
| Cubism Core 许可处置 | 实际使用（发行审计） | 专有 Core 不随包分发；公开产物审计主动拒绝 `live2dcubismcore.min.js` | M `docs/live2d-cubism-core.md`；PR #312 | 继承 |

## 8. 桌面、部署、服务管理与恢复

| 能力 | 状态 | 机制要点 | 证据 | V2 |
| --- | --- | --- | --- | --- |
| Linux 桌面（Tauri + Supervisor + 托盘） | 实际使用 | Supervisor 是独立进程组；关窗即隐藏，托盘 Quit 才退出；`yuvi-daily` systemd 用户单元停止时，10 个 cgroup 进程全部退出 | PR #242–#248（IDX B）；`campaign-g-linux.md`；`linux-release-gate-closure.md` | 重新设计（V2 是单进程 + 单个 SQLite 文件） |
| Linux 公开发行 v0.1.0–v0.1.2 | 实际使用 | 在受信任的 Debian 12 rootfs 中构建（glibc ≤ 2.36）；产物带 SBOM、SHA256SUMS 与 ABI 审计；没有 release workflow | PR #287（v0.1.0）、#301（v0.1.1）、#314/#319（v0.1.2 发行门与收尾）；`docs/releases/linux-release.md` | 发行纪律以后可复用 |
| Windows-first 打包 | 已取代 | 私有 PostgreSQL、凭据管理器、NSIS、托盘 | PR #1、#5–#8、#20（关闭）、#226–#230；#54、#236 撤退 | 不采用（[03 §2.5](03-engineering-lessons.md#25-在无法证明的问题上反复加超时是无效劳动)） |
| R5 发行候选 | 未合并 | 纯文字 profile，自带 Node 24.20.0、PG 16.15、pgvector 0.8.6；不含 STT/TTS、Mem0、Cubism Core | R5 `docs/research/r5-release-candidate/README.zh.md`：全新 Debian 12 VM 首装（apt 145 s）；冷备份后在另一台 VM 恢复，Authority 2 / Journal 12 / A9 46 行一致；旧 Cookie 401；未决派发不重做；同一历史点二次恢复被拒绝。Supervisor SIGKILL 一项 BLOCKED | 冷恢复纪律继承（V2 P3） |
| 崩溃所有权 | 未合并 | systemd 用户 transient service（`KillMode=control-group`、`Restart=no`）；启动时 MainPID、InvocationID、cgroup 三者必须匹配；PG 用 pidfd 核对身份；锁文件记录 boot ID 与内核 start ticks | R5 `docs/research/crash-ownership-upgrade/README.zh.md`：14 类故障矩阵全部 PASS；Vitest 4,145 passed / 57 skipped | 如果 V2 将来要管理子进程，可复用“用 OS 收容，不证明 PID 归属” |
| CI | 实际运行，`main` 红 | `check.yml`（Ubuntu）、`linux-persistence.yml`、`release-conformance.yml`；没有 Windows job，Python 服务测试不在 CI | 本归档的调查代理用 REST 查询：Check 从 `9776aca9`（10-07）到 `0d894cc7` 连续失败，Smoke 步骤 `POST /message` 返回 `503 JOURNAL_UNAVAILABLE`；另两项通过；R5 顶端三项都通过 | 教训：fail-closed 正确，但测试装配没有跟上，CI 的 smoke 实际无效 |

## 9. 权限、身份、隐私与外部操作边界

| 能力 | 状态 | 机制要点 | 证据 | V2 |
| --- | --- | --- | --- | --- |
| 助手自述不得成为权威 | 实际使用 | MemoryEvent 证据模型：记忆存储发生过什么的证据，不权威地改写关系、情绪、人格 | PR #9（08-11，IDX B） | 继承（不变量 3 的来源） |
| Journal 的受众与披露字段 | 已测未部署 | Audience：`PRIVATE{channel}` / `GROUP{channel, membership KNOWN/UNKNOWN/INCOMPLETE}` / `UNKNOWN`；DisclosurePolicy；群聊 membership 填 UNKNOWN（“公开回复不证明听众”）；R5 只在 principal 已解析且受众为 PRIVATE 时加载先前记忆 | M `life-event-journal.ts`；R5 `semantic-policy.ts` | 继承（不变量 4：可见范围随来源传播） |
| Host grants 与原生首次激活 | 未合并 | 256 bit 一次性配对码，只存 SHA-256、五分钟有效，绑定 Person generation、Persona、instance 与 Origin；HttpOnly + SameSite=Strict Cookie，续期轮换；Person 的创建与切换需原生确认 | R5 PR #334/#335：真实 Chromium 与 WebKitGTK 验收；“真实 Provider 测试 B 未运行” | 有多客户端时可复用，复杂度高 |
| 隐私删除 | 实际使用（缺陷）→ 修复未合并 | “Don't forget” 中的 `forget` 被当作删除意图，探针确实删掉了记录；后端异常被写成 `notFound` | 生产智能损失审计 F3；修复 `750eb5e9`（PR #322）：自然语言不再能授权删除。全域隐私删除仍开放 | 继承教训：破坏性操作只能来自显式、有作用域的授权（不变量 1 的“删改”事件） |
| 密钥保管 | 实际使用 | keyring（Secret Service / Credential Manager）；0600 文件；`redactSecretText`；令牌不进模型上下文 | M `apps/desktop/src-tauri/src/config/secrets.rs`、`postgres-secret.ts` | 继承（不变量 9） |
| 外部效果授权 | 已测未部署；部分修复未合并 | A9 意图 outbox；主动发言有同意与静默策略；多角色组合下 read-text 授权路由不挂载，修复在 R5 | M `e659f529`、`16bbfe0e`；审计 F2；R5 `57dab0ae`、`a98adc3c` | 继承“发送确认分层、UNKNOWN 不重放”（不变量 5、8） |
| 声纹与身份四层分离 | 见 §7 | — | — | 继承 |

**本领域总判断：** V1 的权限与来源工程是它最可靠的部分。它保证了“他人的话不会被记成用户自述”“结果未知不伪造成功”“密钥不外泄”。V2 的九条不变量大多来自这里（[04 §2](04-v2-inheritance.md#2-架构原则与不变量)）。代价是：同样的“权威”语言被推广到了模型对自身经历的理解上（[03 §2.1](03-engineering-lessons.md#21-多代理流程变成了架构d5)）。
