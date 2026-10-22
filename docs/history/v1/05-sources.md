# 05　来源索引

> V1 知识归档的一部分，总索引见 [README](README.md)。
>
> - **仓库：** V1 是 [Ruichen-0079/YUVI](https://github.com/Ruichen-0079/YUVI)。下面的链接都指向固定提交，不指向分支，因此不会随分支移动而失效。
> - **核对：** 本表中的每个 path@SHA 都在 2026-10-22 用 V1 的完整克隆（898 个提交、全部分支与 tag）逐一确认存在；PR 状态在同日通过 GitHub REST 重新抓取。
> - **安全：** 编写本归档时没有打开任何数据目录、数据库、日志、`.env`、聊天记录或证据压缩包。私有资产只在 §4 记录类型与存在。

## 1. 固定的基准点

| 名称 | 提交 | 说明 |
| --- | --- | --- |
| V1 `main` | [`0d894cc7`](https://github.com/Ruichen-0079/YUVI/commit/0d894cc70d42ebba0df132924f5ea181c062b431) | 10-09 的最后一次合并；898 个提交 |
| 日常安装构建 | [`5064c29f`](https://github.com/Ruichen-0079/YUVI/commit/5064c29fa85da959b6a5b29a1655bfdadb2a6a3d) | 09-08；10-10、10-11 两次只读核对时日常运行的安装包指向它（R5 文档）；包含 PR ≤ #279 |
| R4/R5 堆叠顶端 | [`a1b89423`](https://github.com/Ruichen-0079/YUVI/commit/a1b894233767827a714dc19c13456f088da982ae) | 分支 `fix/r5-crash-ownership`；PR #322–#337，全部开放；以 `main` 为基 |
| R5 研究文档的引用点 | [`b36d6179`](https://github.com/Ruichen-0079/YUVI/commit/b36d6179770e90cf0ae0a6fee0ba86f856085f6f) | 项目史引用的堆叠顶端快照 |
| Plunge 分支顶端 | [`adff0c70`](https://github.com/Ruichen-0079/YUVI/commit/adff0c70648b42a3a15ea45609adae1c45b31fc5) | 分支 `feat/plunge-webui-20261008`；18 个提交，从未开 PR |
| 项目史研究 | [`3f6a9393`](https://github.com/Ruichen-0079/YUVI/commit/3f6a9393a9d5290d2e924df1c7cf1ab72aa5c382) | PR #338，开放 |
| V2 蓝图 | [`cc05c14f`](https://github.com/Ruichen-0079/YUVI/commit/cc05c14f6cc61c48079e45ad3b807976a73702e5) | PR #339，开放 |
| 研究 tag `research/qq-alice-20261007` | [`3dc91f35`](https://github.com/Ruichen-0079/YUVI/commit/3dc91f35a0b5037d411a79d4b89e9b7762a09cd1) | QQ/Alice 与多角色研究归档 |
| tag `checkpoint/v0.1.3-core-20261007` | [`49150e62`](https://github.com/Ruichen-0079/YUVI/commit/49150e624dcc53bf73849962818529fba3054e4c) | 独立 Character 组合（多角色） |
| tag `v0.1.2-final` | [`82befd3e`](https://github.com/Ruichen-0079/YUVI/commit/82befd3ee503c8470efb53b59f09912ed97a3657) | 最后一个公开 Linux 发行 |
| tag `v0.1.0` | [`022da36f`](https://github.com/Ruichen-0079/YUVI/commit/022da36ffca8571f432b7da8b3c19e39ef5bbe40) | 第一个公开 Linux 发行 |

## 2. 文档（path@SHA）

### 2.1 项目史与研究基础（本归档的主要二手来源）

| 文档 | 内容 |
| --- | --- |
| [`docs/research/project-history/PROJECT_HISTORY.md`](https://github.com/Ruichen-0079/YUVI/blob/3f6a9393a9d5290d2e924df1c7cf1ab72aa5c382/docs/research/project-history/PROJECT_HISTORY.md) @ `3f6a9393` | 05-10 到 10-19 的阶段重建；思想演变；归属；专题追溯 |
| [`docs/research/project-history/HISTORICAL_DEBT.md`](https://github.com/Ruichen-0079/YUVI/blob/3f6a9393a9d5290d2e924df1c7cf1ab72aa5c382/docs/research/project-history/HISTORICAL_DEBT.md) @ `3f6a9393` | 债务 D1–D12；必要的复杂性；历史偶然 |
| [`docs/research/project-history/RESEARCH_FOUNDATIONS.md`](https://github.com/Ruichen-0079/YUVI/blob/3f6a9393a9d5290d2e924df1c7cf1ab72aa5c382/docs/research/project-history/RESEARCH_FOUNDATIONS.md) @ `3f6a9393` | 研究命题 P1–P8；架构原则；已验证机制及其证明范围 |
| [`docs/research/project-history/PR_RESEARCH_INDEX.md`](https://github.com/Ruichen-0079/YUVI/blob/3f6a9393a9d5290d2e924df1c7cf1ab72aa5c382/docs/research/project-history/PR_RESEARCH_INDEX.md) @ `3f6a9393` | 逐个 PR 的 A/B/C/D 归类 |
| [`docs/research/project-history/evidence/pr-index.csv`](https://github.com/Ruichen-0079/YUVI/blob/3f6a9393a9d5290d2e924df1c7cf1ab72aa5c382/docs/research/project-history/evidence/pr-index.csv) @ `3f6a9393` | PR 索引的机器可读版本 |
| [`docs/v2/YUVI_V2_BLUEPRINT.md`](https://github.com/Ruichen-0079/YUVI/blob/cc05c14f6cc61c48079e45ad3b807976a73702e5/docs/v2/YUVI_V2_BLUEPRINT.md) @ `cc05c14f` | V2 蓝图；§1.2 对 V1 根本问题的判断 |
| [`docs/v2/ROADMAP.md`](https://github.com/Ruichen-0079/YUVI/blob/cc05c14f6cc61c48079e45ad3b807976a73702e5/docs/v2/ROADMAP.md) @ `cc05c14f` | 蓝图时期的 V2 路线（已被本仓库 ROADMAP 取代） |

### 2.2 目标、路线与治理

| 文档 | 内容 |
| --- | --- |
| [`AGENTS.md`](https://github.com/Ruichen-0079/YUVI/blob/4bffc50d21ff454466c9c75f2b2513334002715a/AGENTS.md) @ `4bffc50d` | 05-10 的宪章；所有分支上只有这一个提交 |
| [`docs/future/README.md`](https://github.com/Ruichen-0079/YUVI/blob/d37c07564c4709a2256e02f5a2541dba47585f76/docs/future/README.md) @ `d37c0756` | 08-28 路线图；Frozen responsibility map；训练阶段 8–13 |
| [`docs/future/YUVI_OPERATIONAL_LANDING_AUDIT.md`](https://github.com/Ruichen-0079/YUVI/blob/965e8c20492243754d7ba6290da366cd4c109914/docs/future/YUVI_OPERATIONAL_LANDING_AUDIT.md) @ `965e8c20` | 09-01 落地审计（后被标为 HISTORICAL） |
| [`docs/future/atoms/README.md`](https://github.com/Ruichen-0079/YUVI/blob/34fb2dd1e4759cd1d0d967bacda94786686e96bf/docs/future/atoms/README.md) @ `34fb2dd1` | Atom 计划；反过度工程门槛；No-progress gate |
| [`docs/future/09-v0.1.3-platform-completion.md`](https://github.com/Ruichen-0079/YUVI/blob/e4d90d7b6a24ba9347c192d293a4a1c2a4ad8f1b/docs/future/09-v0.1.3-platform-completion.md) @ `e4d90d7b` | v0.1.3 原计划：“最后的地基版本” |
| [`docs/future/09-v0.1.3-platform-completion.md`](https://github.com/Ruichen-0079/YUVI/blob/94e20d0ceb63b127781ed66f60337ac655820001/docs/future/09-v0.1.3-platform-completion.md) @ `94e20d0c` | v0.1.3 最终版：编号相同、含义已变 |
| [`docs/future/00-artificial-person-north-star.md`](https://github.com/Ruichen-0079/YUVI/blob/4278eb36b1a01acde82dde27b806dca996739972/docs/future/00-artificial-person-north-star.md) @ `4278eb36` | 09-19 北极星：人工个体、Life Layer |
| [`docs/future/north-star.md`](https://github.com/Ruichen-0079/YUVI/blob/6f06d8ba0cc786112bcc19cee1e657fccd22f0e3/docs/future/north-star.md) @ `6f06d8ba` | 09-24 因果历史版北极星 |
| [`docs/validation/v0.1.3-future-consolidation.md`](https://github.com/Ruichen-0079/YUVI/blob/07509e47de6d37a3d6b0e934f275ed6779b01b46/docs/validation/v0.1.3-future-consolidation.md) @ `07509e47` | 09-24 的 13 项整合决定 |
| [`docs/future/version-roadmap.md`](https://github.com/Ruichen-0079/YUVI/blob/9776aca9f42ca2cab98bcd041726051d6081ece4/docs/future/version-roadmap.md) @ `9776aca9` | v0.1.4–v0.1.7 版本序列 |
| [`docs/future/research-methodology.md`](https://github.com/Ruichen-0079/YUVI/blob/46a24878536d537021c49d50c5ce004d93489628/docs/future/research-methodology.md) @ `46a24878` | E1–E8 与“先测量后状态” |
| [`docs/future/measured-consolidation.md`](https://github.com/Ruichen-0079/YUVI/blob/0d894cc70d42ebba0df132924f5ea181c062b431/docs/future/measured-consolidation.md) @ `0d894cc7` | 四段式测量整合 |
| [`docs/future/prospective-continuity.md`](https://github.com/Ruichen-0079/YUVI/blob/0d894cc70d42ebba0df132924f5ea181c062b431/docs/future/prospective-continuity.md) @ `0d894cc7` | 承诺/期待/意图/开放线程 |
| [`docs/validation/main-consolidation-2026-10-07.md`](https://github.com/Ruichen-0079/YUVI/blob/f920e4c7888ded3341c64d8a4eb31d8ed0d24642/docs/validation/main-consolidation-2026-10-07.md) @ `f920e4c7` | 10-07 快进 66 个提交；分支审计 |

### 2.3 独立审计与研究（10 月）

| 文档 | 内容 |
| --- | --- |
| [`docs/research/production-intelligence-loss/YUVI-Production-Intelligence-Loss-Audit.zh.md`](https://github.com/Ruichen-0079/YUVI/blob/b307704a0c798fe092966766ad4422a9aaa31262/docs/research/production-intelligence-loss/YUVI-Production-Intelligence-Loss-Audit.zh.md) @ `b307704a` | F1–F8：“Don’t forget”被当作删除、失败被合成为沉默等 |
| [`docs/research/backend-intelligence-value/YUVI-Backend-Intelligence-Value-Audit.zh.md`](https://github.com/Ruichen-0079/YUVI/blob/fb0e1e62841106c533e4edd1d7e60327dc4315b4/docs/research/backend-intelligence-value/YUVI-Backend-Intelligence-Value-Audit.zh.md) @ `fb0e1e62` | F1–F7：场景顶替历史、Profile 无读方、Dream 无时钟 |
| [`docs/research/backend-completeness-audit/YUVI-Backend-Completeness-Audit.zh.md`](https://github.com/Ruichen-0079/YUVI/blob/0d894cc70d42ebba0df132924f5ea181c062b431/docs/research/backend-completeness-audit/YUVI-Backend-Completeness-Audit.zh.md) @ `0d894cc7` | 部分审计：702 个生产候选中深读 16 个（2.28%） |
| [`docs/research/next-generation-architecture/README.md`](https://github.com/Ruichen-0079/YUVI/blob/c28e5901f4ef3578a85ab8fd9513652ddaab5866/docs/research/next-generation-architecture/README.md) @ `c28e5901` | 下一代架构研究 |
| [`docs/research/persistent-internal-state/README.md`](https://github.com/Ruichen-0079/YUVI/blob/b5abb06c9dcdd846fa20152c401eff88aac57205/docs/research/persistent-internal-state/README.md) @ `b5abb06c` | 持续内部状态；三个强反对与形式反例 |
| [`docs/research/runtime-model-value/README.zh.md`](https://github.com/Ruichen-0079/YUVI/blob/a1b894233767827a714dc19c13456f088da982ae/docs/research/runtime-model-value/README.zh.md) @ `a1b89423` | gate 消融；部署版本核对；能力请求实测 |
| [`docs/research/runtime-intelligence-r4/README.zh.md`](https://github.com/Ruichen-0079/YUVI/blob/a1b894233767827a714dc19c13456f088da982ae/docs/research/runtime-intelligence-r4/README.zh.md) @ `a1b89423` | R4：自然更正重启后生效 |
| [`docs/research/runtime-memory-r5/README.zh.md`](https://github.com/Ruichen-0079/YUVI/blob/a1b894233767827a714dc19c13456f088da982ae/docs/research/runtime-memory-r5/README.zh.md) @ `a1b89423` | R5 记忆权威（另有 api、architecture、performance、open-gates 等分册） |
| [`docs/research/compositional-retrieval/README.zh.md`](https://github.com/Ruichen-0079/YUVI/blob/a1b894233767827a714dc19c13456f088da982ae/docs/research/compositional-retrieval/README.zh.md) @ `a1b89423` | 组合检索 |
| [`docs/research/evidence-truthfulness/README.zh.md`](https://github.com/Ruichen-0079/YUVI/blob/a1b894233767827a714dc19c13456f088da982ae/docs/research/evidence-truthfulness/README.zh.md) @ `a1b89423` | 证据支持判断；索引可靠性 |
| [`docs/research/durable-observation-retrieval/vision.zh.md`](https://github.com/Ruichen-0079/YUVI/blob/a1b894233767827a714dc19c13456f088da982ae/docs/research/durable-observation-retrieval/vision.zh.md) @ `a1b89423` | 真实视觉实验 |
| [`docs/research/product-memory-host/README.zh.md`](https://github.com/Ruichen-0079/YUVI/blob/a1b894233767827a714dc19c13456f088da982ae/docs/research/product-memory-host/README.zh.md) @ `a1b89423` | Host grants 与多客户端 |
| [`docs/research/r5-release-candidate/README.zh.md`](https://github.com/Ruichen-0079/YUVI/blob/a1b894233767827a714dc19c13456f088da982ae/docs/research/r5-release-candidate/README.zh.md) @ `a1b89423` | 发行候选：全新 VM 首装与冷恢复 |
| [`docs/research/r5-release-candidate/evidence/pr-stack.json`](https://github.com/Ruichen-0079/YUVI/blob/a1b894233767827a714dc19c13456f088da982ae/docs/research/r5-release-candidate/evidence/pr-stack.json) @ `a1b89423` | PR #322–#335 与分支的对应 |
| [`docs/research/crash-ownership-upgrade/README.zh.md`](https://github.com/Ruichen-0079/YUVI/blob/a1b894233767827a714dc19c13456f088da982ae/docs/research/crash-ownership-upgrade/README.zh.md) @ `a1b89423` | systemd/cgroup 收容；14 类故障矩阵 |

### 2.4 子系统的设计与收口记录

| 文档 | 内容 |
| --- | --- |
| [`docs/future/campaign-b-closure.md`](https://github.com/Ruichen-0079/YUVI/blob/0d894cc70d42ebba0df132924f5ea181c062b431/docs/future/campaign-b-closure.md) @ `0d894cc7` | 本地 STT 实机 |
| [`docs/future/campaign-d-closure.md`](https://github.com/Ruichen-0079/YUVI/blob/0d894cc70d42ebba0df132924f5ea181c062b431/docs/future/campaign-d-closure.md) @ `0d894cc7` | 语音模式与打断 |
| [`docs/future/campaign-e-visual-grounding.md`](https://github.com/Ruichen-0079/YUVI/blob/0d894cc70d42ebba0df132924f5ea181c062b431/docs/future/campaign-e-visual-grounding.md) @ `0d894cc7` | 按需截屏 |
| [`docs/future/campaign-f-presentation.md`](https://github.com/Ruichen-0079/YUVI/blob/0d894cc70d42ebba0df132924f5ea181c062b431/docs/future/campaign-f-presentation.md) @ `0d894cc7` | Live2D 动作合成 |
| [`docs/future/campaign-g-linux.md`](https://github.com/Ruichen-0079/YUVI/blob/0d894cc70d42ebba0df132924f5ea181c062b431/docs/future/campaign-g-linux.md) @ `0d894cc7` | Linux 日常安装与验收 |
| [`docs/future/campaign-h-closure.md`](https://github.com/Ruichen-0079/YUVI/blob/0d894cc70d42ebba0df132924f5ea181c062b431/docs/future/campaign-h-closure.md) @ `0d894cc7` | 主动性模型对比；稳定前缀缓存 |
| [`docs/future/campaign-i-closure.md`](https://github.com/Ruichen-0079/YUVI/blob/dd4c6379e6159ce4def3b478c60fbe3a52d3d7f3/docs/future/campaign-i-closure.md) @ `dd4c6379` | TTS 休眠与性能 |
| [`docs/future/campaign-a-closure.md`](https://github.com/Ruichen-0079/YUVI/blob/a3152034f60cd5449b2a9b4e8060293989ce8cb8/docs/future/campaign-a-closure.md) @ `a3152034` | Campaign A 的 PR 处置 |
| [`docs/future/linux-release-gate-closure.md`](https://github.com/Ruichen-0079/YUVI/blob/aea52ee307b3223ba397703f7d3ff04ccb9258da/docs/future/linux-release-gate-closure.md) @ `aea52ee3` | Linux 发行门 |
| [`docs/future/astra5-linux-release-evidence.md`](https://github.com/Ruichen-0079/YUVI/blob/0d894cc70d42ebba0df132924f5ea181c062b431/docs/future/astra5-linux-release-evidence.md) @ `0d894cc7` | 打包与声纹真实验收 |
| [`docs/releases/linux-release.md`](https://github.com/Ruichen-0079/YUVI/blob/0d894cc70d42ebba0df132924f5ea181c062b431/docs/releases/linux-release.md) @ `0d894cc7` | 发行流程 |
| [`docs/live2d-cubism-core.md`](https://github.com/Ruichen-0079/YUVI/blob/0d894cc70d42ebba0df132924f5ea181c062b431/docs/live2d-cubism-core.md) @ `0d894cc7` | Cubism Core 许可处置 |
| [`docs/character-response-streaming.md`](https://github.com/Ruichen-0079/YUVI/blob/0d894cc70d42ebba0df132924f5ea181c062b431/docs/character-response-streaming.md) @ `0d894cc7` | gate + 流式正文 |
| [`docs/future/a12.1-snowluma-contract.md`](https://github.com/Ruichen-0079/YUVI/blob/0d894cc70d42ebba0df132924f5ea181c062b431/docs/future/a12.1-snowluma-contract.md) @ `0d894cc7` | SnowLuma 源码合同 |
| [`docs/architecture/multi-character.md`](https://github.com/Ruichen-0079/YUVI/blob/0d894cc70d42ebba0df132924f5ea181c062b431/docs/architecture/multi-character.md) @ `0d894cc7` | 独立 Character 组合 |
| [`docs/future/08-character-post-training.md`](https://github.com/Ruichen-0079/YUVI/blob/0d894cc70d42ebba0df132924f5ea181c062b431/docs/future/08-character-post-training.md) @ `0d894cc7` | 角色后训练（延期） |
| [`docs/future/10-v0.1.4-people-profile.md`](https://github.com/Ruichen-0079/YUVI/blob/0d894cc70d42ebba0df132924f5ea181c062b431/docs/future/10-v0.1.4-people-profile.md) @ `0d894cc7` | People & Profile（计划） |
| [`docs/future/a8.2-ingress-closure.md`](https://github.com/Ruichen-0079/YUVI/blob/e21ebc8499273a94ce262d656d734c7bedb15947/docs/future/a8.2-ingress-closure.md) @ `e21ebc84` | Journal 入口全覆盖 |
| [`docs/validation/v0.1.3-a10.1a-llm-memory-grounding.md`](https://github.com/Ruichen-0079/YUVI/blob/8e0c1ebd61ad3adb121219eff931e0f6b185b749/docs/validation/v0.1.3-a10.1a-llm-memory-grounding.md) @ `8e0c1ebd` | 用桩模型复现伪造归因 |
| [`docs/validation/v0.1.3-a11.2-release-conformance.md`](https://github.com/Ruichen-0079/YUVI/blob/94e20d0ceb63b127781ed66f60337ac655820001/docs/validation/v0.1.3-a11.2-release-conformance.md) @ `94e20d0c` | 持久一致性门 |
| [`services/local-stt/models.manifest.json`](https://github.com/Ruichen-0079/YUVI/blob/0d894cc70d42ebba0df132924f5ea181c062b431/services/local-stt/models.manifest.json) @ `0d894cc7` | STT 模型清单（sha256、许可证） |
| [`docs/future/evidence/campaign-h/proactive-comparison.json`](https://github.com/Ruichen-0079/YUVI/blob/0d894cc70d42ebba0df132924f5ea181c062b431/docs/future/evidence/campaign-h/proactive-comparison.json) @ `0d894cc7` | 主动性对比原始结果 |
| [`docs/validation/plunge-local-audit-2026-10-07.md`](https://github.com/Ruichen-0079/YUVI/blob/adff0c70648b42a3a15ea45609adae1c45b31fc5/docs/validation/plunge-local-audit-2026-10-07.md) @ `adff0c70` | 旧 QQ 插件审计与迁移分类 |
| [`docs/validation/character-linear-context-2026-10-08.md`](https://github.com/Ruichen-0079/YUVI/blob/adff0c70648b42a3a15ea45609adae1c45b31fc5/docs/validation/character-linear-context-2026-10-08.md) @ `adff0c70` | 线性上下文 v1 |
| [`docs/validation/local-attention-qq-integration-2026-10-08.md`](https://github.com/Ruichen-0079/YUVI/blob/adff0c70648b42a3a15ea45609adae1c45b31fc5/docs/validation/local-attention-qq-integration-2026-10-08.md) @ `adff0c70` | 本地 4B 预过滤 |

## 3. 关键提交与 PR

### 3.1 提交

| 提交 | 内容 |
| --- | --- |
| [`4bffc50d`](https://github.com/Ruichen-0079/YUVI/commit/4bffc50d21ff454466c9c75f2b2513334002715a) | 05-10 第一次提交与宪章 |
| [`d96edbc0`](https://github.com/Ruichen-0079/YUVI/commit/d96edbc0a28710cfaadbf53c58704dd788c35fe4) | 日常经历默认不存储（助手式记忆） |
| [`806862c1`](https://github.com/Ruichen-0079/YUVI/commit/806862c19873e1cfe99cd9f9f7b1cd8f4c074e9c) | 05-26 关键词情绪 CurrentAffect |
| [`e4d90d7b`](https://github.com/Ruichen-0079/YUVI/commit/e4d90d7b6a24ba9347c192d293a4a1c2a4ad8f1b) | 09-12 v0.1.3 原计划 |
| [`4278eb36`](https://github.com/Ruichen-0079/YUVI/commit/4278eb36b1a01acde82dde27b806dca996739972) | 09-19 北极星（tag `qq-snowluma-v1.0.0` 也指向这里，而不是插件代码） |
| [`334ccd4b`](https://github.com/Ruichen-0079/YUVI/commit/334ccd4b67035922ba0ec1ff649332a8fa4186ef) | 09-12 gate + 流式正文（PR #317） |
| [`d1d8b090`](https://github.com/Ruichen-0079/YUVI/commit/d1d8b0900d8390b1200cdb47998f4a7526c653cd) | 10-04 A9.3 收紧 fallback |
| [`9776aca9`](https://github.com/Ruichen-0079/YUVI/commit/9776aca9f42ca2cab98bcd041726051d6081ece4) | 10-07 快进合入；`main` 的 Check 从这里开始连续失败 |
| [`49150e62`](https://github.com/Ruichen-0079/YUVI/commit/49150e624dcc53bf73849962818529fba3054e4c) | 10-07 独立 Character 组合 |
| [`734e1e12`](https://github.com/Ruichen-0079/YUVI/commit/734e1e12ef7e3fdfd51f33925152b0f2fa27a8c9) | 10-08 线性上下文 v1（Plunge） |
| [`9a99ae7d`](https://github.com/Ruichen-0079/YUVI/commit/9a99ae7db0f53bda9efaf95bb79d0fee58c5ba25) | QQ 准入规则 + 本地 4B 预过滤（Plunge） |
| [`c1475dae`](https://github.com/Ruichen-0079/YUVI/commit/c1475daec6593e681208a9cc52150c5c06780c1f) | 退役关键词情绪（PR #322，不是 `main` 的祖先） |
| [`750eb5e9`](https://github.com/Ruichen-0079/YUVI/commit/750eb5e920dc76f1e18052d681d616e7a5423cdf) | 自然语言不再能授权删除（PR #322） |
| [`0ad384fc`](https://github.com/Ruichen-0079/YUVI/commit/0ad384fc212a2c1e1768688953e3193a119d5248) | 忽略 SSE 注释帧（PR #323） |
| [`d7133897`](https://github.com/Ruichen-0079/YUVI/commit/d71338972ca651028e10a2fce2177816fe01d5fc) | 去掉 800 字逐行截断（PR #323） |
| [`bb77495c`](https://github.com/Ruichen-0079/YUVI/commit/bb77495c6cab805c35f35f5d649dbb1836c710f1) | `length` 正文作为 PARTIAL 保存（PR #323） |
| [`9385499e`](https://github.com/Ruichen-0079/YUVI/commit/9385499e0f5091ee285ad19468e546f23f3b760c) | Provider 替换不再改变控制结构（PR #327） |

**不可达的提交：** 构建旧 QQ 插件的 `7dcf4b01`、`e8a09719`、`dbb4b984` 在 V1 的完整克隆中不存在（2026-10-22 实测）。

### 3.2 PR

截至 2026-10-22，V1 共有 338 个 PR（#1–#339，#51 是 issue）：287 个合并，33 个关闭未合并，18 个开放（#322–#339）。

| PR | 日期 | 内容 |
| --- | --- | --- |
| [#1](https://github.com/Ruichen-0079/YUVI/pull/1) | 06-21 | Windows-first 开发基线 |
| [#2](https://github.com/Ruichen-0079/YUVI/pull/2) | 08-04 | 桌面、Live2D、TTS 加 Mem0，+58,913 行 |
| [#8](https://github.com/Ruichen-0079/YUVI/pull/8) | 08-05 | Mem0 PyInstaller sidecar，33 个提交 |
| [#9](https://github.com/Ruichen-0079/YUVI/pull/9) | 08-11 | MemoryEvent 证据模型；助手自述不得成为权威；关闭 Mem0 `infer` |
| [#11](https://github.com/Ruichen-0079/YUVI/pull/11) | 08-12 | P4 持久摄取账本（#11–#17）；`UNKNOWN` 的雏形 |
| [#20](https://github.com/Ruichen-0079/YUVI/pull/20) | 08-15 | Windows 私有 PostgreSQL 进程身份证明；27 个提交、44 条评论；关闭 |
| [#54](https://github.com/Ruichen-0079/YUVI/pull/54) | 08-25 | Linux-first 重定基线 |
| [#61](https://github.com/Ruichen-0079/YUVI/pull/61) | 08-26 | 70B 决策 + V4 写作的双模型主动路径 |
| [#82](https://github.com/Ruichen-0079/YUVI/pull/82) | 08-27 | Future 01–08 与责任表 |
| [#96](https://github.com/Ruichen-0079/YUVI/pull/96) | 08-30 | 过早合并，随后由 #97 回滚 |
| [#115](https://github.com/Ruichen-0079/YUVI/pull/115) | 08-31 | Harness 5L：适配器等待从未出现的后训练模型 |
| [#143](https://github.com/Ruichen-0079/YUVI/pull/143) | 08-31 | Memory vNext L0/L1/L2 与 Dream |
| [#155](https://github.com/Ruichen-0079/YUVI/pull/155) | 08-31 | Cognition 收尾：生产仍走旧路径 |
| [#203](https://github.com/Ruichen-0079/YUVI/pull/203) | 09-01 | Memory-first 重定基线；训练延期 |
| [#235](https://github.com/Ruichen-0079/YUVI/pull/235) | 09-05 | No-progress gate |
| [#236](https://github.com/Ruichen-0079/YUVI/pull/236) | 09-05 | Linux-first CI，删除 Windows 作业 |
| [#260](https://github.com/Ruichen-0079/YUVI/pull/260) | 09-06 | backlog 保留规则与反过度工程 |
| [#283](https://github.com/Ruichen-0079/YUVI/pull/283) | 09-08 | 补上生产语义接线（不在日常安装构建中） |
| [#287](https://github.com/Ruichen-0079/YUVI/pull/287) | 09-09 | v0.1.0 |
| [#301](https://github.com/Ruichen-0079/YUVI/pull/301) | 09-09 | v0.1.1 |
| [#317](https://github.com/Ruichen-0079/YUVI/pull/317) | 09-12 | gate + 流式正文 |
| [#319](https://github.com/Ruichen-0079/YUVI/pull/319) | 09-13 | v0.1.2 收尾（tag `v0.1.2-final`） |
| [#321](https://github.com/Ruichen-0079/YUVI/pull/321) | 09-20 | 持久功能性自我；10-07 关闭，保留 E7/E8 |
| [#322](https://github.com/Ruichen-0079/YUVI/pull/322) | 10-10 | R4/R5 堆叠起点：撤除关键词情绪、修正删除语义 |
| [#323](https://github.com/Ruichen-0079/YUVI/pull/323) | 10-10 | 截断与心跳丢文修复 |
| [#324](https://github.com/Ruichen-0079/YUVI/pull/324) | 10-11 | R4 自然更正 |
| [#327](https://github.com/Ruichen-0079/YUVI/pull/327) | 10-13 | 测试不再绕过 Character |
| [#336](https://github.com/Ruichen-0079/YUVI/pull/336) | 10-19 | R5 发行候选与冷恢复 |
| [#337](https://github.com/Ruichen-0079/YUVI/pull/337) | 10-19 | systemd/cgroup 崩溃收容 |
| [#338](https://github.com/Ruichen-0079/YUVI/pull/338) | 10-19 | 项目史研究 |
| [#339](https://github.com/Ruichen-0079/YUVI/pull/339) | 10-19 | V2 蓝图 |

其余 PR 的归类见 `PR_RESEARCH_INDEX.md`（§2.1）。

## 4. 私有或访问受限的资产（只记录存在）

以下资产在可信记录中被提到或在仓库中可见其存在。本归档**没有打开、复制或摘录**它们的内容，V2 也不使用它们，除非负责人在某个里程碑中明确批准。

| 资产类型 | 存在的依据 | 处置 |
| --- | --- | --- |
| Alice 的日常安装：数据库、凭据、配置、私人记忆 | R5 文档记录了只读核对“未修改她的安装、配置、数据库或 QQ” | 不接触；不导入 V2 |
| 真实 QQ 账号、群号、私聊对象与原始交互日志 | Plunge 验证文档提到真人测试，原始请求与日志在私有目录、未入库 | 不接触；本归档不转录这些文档中的标识 |
| 研究 tag 中的证据压缩包：`QQ-research-evidence-2026-10-07.zip`、`YUVI-Multi-Character-evidence-2026-10-07.zip` | tag `research/qq-alice-20261007` 的文件列表 | 未打开 |
| 真实回放样本（项目史中引用的 QQ 片段） | `PROJECT_HISTORY.md` 阶段 7 | 不转录 |
| 声纹模板 | `services/local-stt/speaker_store.py` 的存储设计 | 真实声纹需负责人批准 |
| 人格校准证据（v7–v10） | PR #222，证据未入库 | 不可得 |
| TTS 选型 bakeoff 记录 | Campaign D 写明未重复 | 不可得 |
| 与模型和代理的规划对话 | 项目史 D12：需求与取舍主要发生在对话中，未入库 | 不可得 |
| V1 的密钥与令牌 | keyring、0600 文件、私有配置 | 不接触 |

## 5. 本归档是怎样做的

- **二手来源：** 以 §2.1 的项目史研究为主线。它的每条引用在使用前按原 SHA 回查（部分数字由调查代理复算，见各文件标注）。
- **一手核对：** 源码、文档与测试按 §1 的固定提交阅读；关键的祖先关系（如 `c1475dae` 不在 `main`、`5064c29f` 是 `main` 的祖先）用 `git merge-base --is-ancestor` 实测。
- **分工：** 五个只读调查分别覆盖运行时与消息、QQ 与身份权限、主动性与情绪研究、语音视觉与部署、治理与跨领域失败，结果由 Claude 汇总、核对并改写。
- **既有文档的整合：** 记忆子系统直接引用 [`docs/research/memory/`](../../research/memory/README.md)，不重复。

