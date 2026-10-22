# 04　V1 对 V2 的继承分类

> V1 知识归档的一部分，总索引见 [README](README.md)。依据见 [02](02-systems.md)（各子系统）与 [03](03-engineering-lessons.md)（教训）。
>
> **记忆子系统**的逐项继承已在 [`docs/research/memory/02-inheritance.md`](../../research/memory/02-inheritance.md) 中完成，本文不重复，只在 §4 给出对照。那份文档用“保留 / 重实现 / 替换 / 放弃”四类，与本文的对应关系是：
>
> | 记忆文档 | 本文 |
> | --- | --- |
> | 保留 | 已继承 |
> | 重实现 | 以后可复用 |
> | 替换 | 需重新设计 |
> | 放弃 | 不采用 |

## 0. 五个类别

| 类别 | 含义 |
| --- | --- |
| **已继承** | V2 已有等价物，或这一原则已写入 `AGENTS.md`、TERMS、规格或 ROADMAP |
| **以后可复用** | 现在不需要；需要时可以参考或移植 V1 已验证的算法、常数或代码。移植时在规格中写明来源（path@SHA） |
| **需重新设计** | 问题是真实的，V1 的做法不适合 V2 的研究宗旨或结构 |
| **不采用** | 问题本身不属于 V2，或做法与研究宗旨冲突 |
| **暂无结论** | V1 没有足够的证据，V2 需要自己的实验才能判断 |

**V2 从 V1 继承的是知识，不是代码、架构或生活。** 具体来说：

- V2 是一个新个体，不继承 Alice 的生活，也不导入 V1 的历史（ROADMAP §1、§7）；
- V1 的人格文本、关系、聊天记录、声纹与记忆不进入 V2，也不作为 V2 个体的记忆；
- 接触任何 V1 真实数据，都需要负责人明确批准的里程碑（`AGENTS.md`“实施、验收与 PR”）。

## 1. 研究命题

来自 V1 研究基础（`RESEARCH_FOUNDATIONS.md` @ `3f6a9393` §1），状态以本归档调查为准。

| # | 命题 | V1 的状态 | V2 中的位置 | 类别 |
| --- | --- | --- | --- | --- |
| P1 | 过去必须改变未来，而不只是可被回忆；原话已不记得时，影响也可以留存 | 未检验；只证明了事实可被召回 | ROADMAP WP-E/F：回忆与浮现、重整与激活，可开关、可比较 | 已继承（作为研究目标） |
| P2 | 同一段生命跨越可替换的机械；换模型不是换人 | 数据与身份在冷恢复下可延续 [B]；行为层面未检验 | 不变量 6（记忆与潜在状态是带版本的资产）；ROADMAP §5“换模型后的连续性” | 已继承（原则）；行为连续性暂无结论 |
| P3 | 程序忠实记录，语义交给模型 | 小样本支持；反向做法多处失败；`main` 没有落实 | `AGENTS.md` 研究宗旨第一条；P4 的原文组装；P7 的呈现记录 | 已继承 |
| P4 | 自我生成不能自证，但真实的选择与其后果是经历 | 前半强制执行 [B]；后半从未实现 | 不变量 3（`inner` 不要求证据，身份/权限/删除核对来源）；档案记录 `act` | 已继承（以 V2 自己的形式：它的内心文字是它的，不需要证据；关于外部世界的权威仍需来源） |
| P5 | 人格有惯性而非刚性 | 未检验 | ROADMAP §5 潜在组织 | 暂无结论 |
| P6 | 内部生活是慢变量，先改变注意，后才可能行动 | 未实现；被 09-24 整合禁止 | 研究宗旨；ROADMAP §5 潜在组织 | 需重新设计（禁令改为实验门槛） |
| P7 | 时间留下痕迹：时间印象与保留影响的遗忘 | 未实现；早期设计反而拒绝保存日常经历 | P4 的带日期本地时间；WP-F 激活的衰减 | 已继承（作为研究目标） |
| P8 | 社会参与回应有证据的机会，而不是回复压力 | 设计，未检验 | ROADMAP §5“QQ 与多人场景” | 暂无结论 |

## 2. 架构原则与不变量

V2 `AGENTS.md` 的九条不变量，以及它们在 V1 中的来源：

| V2 不变量 | V1 来源 | 证据 |
| --- | --- | --- |
| 1 档案只追加，更正与删改用新事件 | Journal 接收凭证（A8）；R5 命题“取代但保留历史” | `docs/future/a8.2-ingress-closure.md`；PR #324 |
| 2 每个事件有类别、场景、作者、时间；不知道写 `unknown` | 归因一等公民（Atom 12/13）；线性上下文的作者标签 | PR #245、#249、#250；Plunge `734e1e12` |
| 3 `inner` 不分类、不要求证据；只有身份、权限、删除核对来源 | PR #9“助手自述不得成为权威”；RESEARCH_FOUNDATIONS 原则 6 对其过度推广的批评 | PR #9；`RESEARCH_FOUNDATIONS.md` §2.6 |
| 4 可见范围随来源传播 | Journal Audience / DisclosurePolicy；R5 只在 PRIVATE 时加载先前记忆 | M `life-event-journal.ts`；R5 `semantic-policy.ts` |
| 5 对外效果遵循“意图 → 尝试 → 结果”，未知记 `UNKNOWN` 不重发 | P4 投递账本（PR #11–#17）；A9 effect 账本；SnowLuma 合同 | `v0.1.3-a9.2-dispatch-reconciliation-crash-ambiguity.md`；R5 崩溃矩阵第 6 项 |
| 6 索引可以重建；记忆与潜在状态是带版本的资产 | R5 索引代际、水位、VERIFY/REBUILD | R5 `evidence-truthfulness/index-reliability.zh.md` |
| 7 分支三类：`main` / `dev:` / `fork:` | 北极星 §12“不能随意分叉、重置”；R5 冷恢复“同一历史点二次恢复被拒绝” | R5 `r5-release-candidate/README.zh.md` |
| 8 对外效果永远不私有；人读私人内容要走有记录的审阅 | 外部效果授权（A9）；隐私删除的失败教训 | 生产智能损失审计 F3 |
| 9 密钥不进入数据库、日志和错误信息 | keyring、0600 文件、`redactSecretText` | M `secrets.rs`、`postgres-secret.ts` |

不变量之外，下列原则已写入 V2 的 `AGENTS.md`：

- 程序只处理可核验的关系，不做语义标注（[03 §1.2](03-engineering-lessons.md#12-程序替模型理解d7)）；
- 不为了好实现而把研究对象换成显式字段（V2 蓝图 §1.2）；
- 不预先建立通用抽象；边界在真实需求出现后再定（[03 §1.5](03-engineering-lessons.md#15-为模型的弱点设计会固化弱点d6)）；
- 引入外部组件前写明独有价值、许可证与替换成本（[03 §3.1](03-engineering-lessons.md#31-外部组件的价值要在引入前写下d3)）；
- 报告区分实测与推断（[03 §2.4](03-engineering-lessons.md#24-测试证明的范围被高估d10)）；
- 以里程碑为单位委派与验收，协作安全留在流程层（[03 §2.1](03-engineering-lessons.md#21-多代理流程变成了架构d5)）。

## 3. 能力继承总表（记忆以外）

按 [02](02-systems.md) 的领域排列。

### 3.1 已继承

| V1 能力或原则 | V2 中的形式 |
| --- | --- |
| 原文进入上下文，不逐行截断，不摘要（PR #323、#327 的教训） | P4 的原文窗口（P6 增量化） |
| 线性、带作者的上下文（Plunge 线性上下文 v1 的思想） | P4 起的对话组装（P7 统一组装入口） |
| 每个产物写明消费者；事后能看到模型实际读到了什么 | P7 的 `control/presented` 与 `presented show`（规格已合并，实施 PR #18 验收中） |
| `UNKNOWN` 不重发；失败、不存在、不确定与沉默彼此区分 | 不变量 5；P1 的 `act/reply_attempt` 与 `control/error`；TERMS“沉默 ≠ 失败” |
| 沉默是合法的输出，而且是一段经历 | `act/silent`（P2），与失败 `control/error` 分开（V1 的 SILENCE 不入历史是反例，PR #234） |
| 用户原话在生成之前入档，与回复成败无关 | P1 `heard` 先于生成入档 |
| 冷备份、冷恢复，旧恢复点不复用 | P3 |
| 单实例、单写者 | P3 单实例锁 |
| 破坏性操作只能来自显式、有作用域的授权 | 不变量 1 的“删改”事件；“Don't forget”教训 |
| 测试离线；结论区分基础设施与假说 | `AGENTS.md` |
| 研究方法：预注册、强文本基线、状态交换与消融、失败判据 | ROADMAP WP-D 评测、WP-E/F 验收（[`research/memory/03`](../../research/memory/03-architecture.md)） |

### 3.2 以后可复用

| V1 能力 | 什么时候用 | 参考 |
| --- | --- | --- |
| SnowLuma / OneBot 源码合同：`message_id` 会碰撞、无去重、发送成功只表示网关收到 | QQ 与多人场景（ROADMAP §5） | M `docs/future/a12.1-snowluma-contract.md`；需对当时的版本重新验证 |
| Plunge 的发送确认分层、Host 而非插件掌握身份、未绑定的发送者没有记忆权限 | 同上 | P `apps/server/src/plunge/*` |
| 本地 STT 服务边界与模型清单（sha256、字节数、许可证） | 语音 | M `services/local-stt/` |
| TTS 服务形态：先绑端口、单并发返回 429、空闲休眠、取消栅栏 | 语音 | M `services/dots-tts/README.md`；Campaign I 的显存与延迟数字 |
| 声纹四层身份分离：说话人聚类 / 声纹档案 / Person / 显示名；只接受可信控制者的绑定 | 声纹（真实声纹需负责人批准） | Atom 13（PR #249/#250） |
| 语音端点常数：650 / 1,200 / 2,200 / 3,000 ms；预录 400 ms；只把确认播放的内容发到字幕 | 语音 | `campaign-d-closure.md` |
| 按需、一次性的视觉：每回合最多一次截屏和一次 Vision，截图不入档 | 视觉 | Campaign E；PR #260 |
| Live2D 动作合成的硬边界与嘴部由音频独占；Cubism Core 不随包分发 | 身体 | Campaign F；`docs/live2d-cubism-core.md` |
| 稳定前缀与缓存命中计量（15.89% → 66.73%） | 模型调用成本优化 | Campaign H `evidence/prompt-cache.json` |
| Fallback 判定：只有未开始且无可见输出时才切换 | 有多个模型路由时 | M `types/errors.ts` |
| 流式取消、owner 检查、可见输出后不再 fallback | 已部分采用；以后扩展 | M `routes/message-stream.ts`、`transport-abort.ts` |
| 所有者确认 + 回执 + UNKNOWN 可恢复的命令模式 | 身份绑定、人物命令 | M `product-person-command-effects.ts` |
| 用 OS 收容进程（systemd 用户服务 + cgroup），不证明 PID 归属 | 如果将来要管理子进程（例如嵌入进程） | R5 `crash-ownership-upgrade/README.zh.md` |
| 在固定 rootfs 中构建、SBOM、ABI 审计 | 正式发行 | `docs/releases/linux-release.md` |
| 行为评估场景（STOP、EPI、REL 等 YBE 场景） | 行为回归的种子 | PR #206 |
| E7（惯性与合理修订）、E8（自身行动与后果）的实验设计 | 潜在组织研究 | M `docs/future/research-methodology.md` |
| 持续内部状态研究的三个强反对作为必过检验 | 潜在组织研究 | M `docs/research/persistent-internal-state/` |
| 测量整合中的暴露与选择日志、机会分母 | WP-D 评测 | M `docs/future/measured-consolidation.md` |

### 3.3 需重新设计

| 问题 | V1 的做法 | 为什么要重新设计 |
| --- | --- | --- |
| 主动开口 | 计时器 + 门槛 + 一次分类或打分 | 主动性应来自它自己的经历与内部组织（ROADMAP §5“主动开口与心意”，在 WP-F 之后） |
| 离线期间的内部变化 | Dream：正则与 Jaccard 触发的规则二次抽取 | 违反“不做语义标注”；V2 的“重整”由它自己完成（WP-F） |
| 未经询问而浮现的旧经历 | 联想侵入：词元重叠 + 固定阈值 | 行为目标保留；判定交给激活与模型（WP-E） |
| 慢速、非语言的内部状态 | Life Layer（按心理学命名），随后被禁令排除 | 禁令改为实验门槛；不按心理学命名（ROADMAP §5 潜在组织） |
| 群聊参与 | 准入规则、小模型预过滤、授权分类，失败即沉默 | 主模型应看到完整的场景；“理解后不回”与“分类失败”必须可区分 |
| 群聊场景的上下文 | 12 条 / 120 s 的短场景顶替持久历史 | 不能用易失的场景顶替忠实的历史 |
| 能力调用 | 自定义文本协议，CONTINUE 不累积进展 | 改用原生工具协议；授权入口要真实可用 |
| 进程与部署 | Tauri + Supervisor + 应用自管 PostgreSQL + 多个 Python sidecar | V2 是单进程、单个 SQLite 文件；运行与部署另有工作包（ROADMAP §3） |
| CI 门禁 | fail-closed 的 Journal 让 smoke 永远 503，CI 长期红 | 测试装配必须与生产前提一致；语音服务测试要纳入 CI |

### 3.4 不采用

| V1 能力 | 理由 |
| --- | --- |
| CurrentAffect 关键词情绪 | 程序语义标注；实测误判否定句 |
| 正则判定“重要”“未解决”“任务状态” | 同上 |
| Gate + 正文两次调用；Character ABI 与 Harness | 为假想的后训练模型和模型弱点而建；R5 消融（n=3）看不到 gate 的质量增益 |
| Character / Cognition 双模型分工；`NEED_COGNITION` 文本协议 | 同上 |
| P6 Web 端规则主动性 | 已被 V1 自己取代 |
| 旧 QQBot 插件；Plunge 管理 WebUI | 专为旧插件或 Alice 部署而建 |
| Windows-first 打包、私有 PostgreSQL 进程身份证明 | [03 §2.5](03-engineering-lessons.md#25-在无法证明的问题上反复加超时是无效劳动)、§3.2 |
| Mem0 及其 sidecar 与投递账本 | [03 §3.1](03-engineering-lessons.md#31-外部组件的价值要在引入前写下d3) |
| “唯一权威”表、atom 粒度、Campaign/Atom/Astra 编号、治理词汇 | [03 §2.1](03-engineering-lessons.md#21-多代理流程变成了架构d5)；TERMS §3 |
| V1 `AGENTS.md` 的第 4、5、12 条与默认 Provider | [03 §1.1](03-engineering-lessons.md#11-给代理的宪章就是架构d1) |
| Alice 的人格、关系与生活；V1 的“校准版”人格 | V2 是新个体（ROADMAP §1、§7） |
| 行为规范与偏好数据集的格式；SFT/DPO 训练路线 | 为未执行的训练计划准备 |
| Profile 物化；P8 关系作为程序维护的状态 | 没有读方或没有意义的生产者；对人的理解就是它写下的、与这个人有关的经历 |

### 3.5 暂无结论

| 问题 | 为什么没有结论 | V2 什么时候回答 |
| --- | --- | --- |
| 群聊中是否需要小模型预过滤 | 只有成功样本，没有对照实验 | QQ 与多人场景时 |
| TTS / STT / VLM 的具体模型选择 | bakeoff 证据不在仓库；VLM 只有 2 张合成图的样本 | 接入语音、视觉时 |
| Avatar 是否必要 | 从未作为研究问题提出 | 由负责人在身体方向上决定 |
| 观测（截图报告）的留存与擦除 | 只在未合并分支，全域删除未完成 | 接入视觉时 |
| 行为层面的跨模型连续性 | 从未检验 | ROADMAP §5“换模型后的连续性” |
| 人格惯性、慢变量的增量价值 | 从未被允许检验 | 潜在组织研究 |
| 多人场景中主模型直接阅读完整原始流的成本与质量曲线 | 只有一个样本 | QQ 与多人场景时 |

## 4. 记忆子系统：与 `research/memory/02` 的对照

逐项内容以 [`research/memory/02-inheritance.md`](../../research/memory/02-inheritance.md) 为准，这里只列各类的代表：

| 本文类别 | 代表项（记忆文档中的处理） |
| --- | --- |
| 已继承 | Journal 只追加（保留）；意图 → 尝试 → 结果（保留）；原话先于生成入档（保留）；冷恢复（保留）；单写者（保留）；L0 直接上下文（保留） |
| 以后可复用 | 派生索引的代际、水位与重建（重实现）；汉字单字 + 二元组切分（重实现，倒排交给 FTS5）；检索运行记录（重实现）；联想侵入（重实现为研究机制） |
| 需重新设计 | R5 命题权威 → 它自己写下的文字 + 可核验的形成关系（替换）；Dream → 重整（替换）；组合检索 → 它自己在工具循环中多次查询（替换） |
| 不采用 | Mem0、`memories` 的类型 / 重要性 / 保留期、CurrentAffect、L1 情节、Profile / P8 关系、查询扩展与证据支持判断（放弃） |
| 暂无结论 | 向量通道（按需引入，见 ROADMAP WP-G）；PostgreSQL（目前不采用，到多进程写或 10M 级时再评估） |
