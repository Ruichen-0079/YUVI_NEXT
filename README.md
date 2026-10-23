# YUVI_NEXT

YUVI 的第二代（V2）。一个持续运行的人工个体：发生的事按时间写进只追加的档案，可替换的语言模型阅读档案来生活。V1 与研究历史在 [Ruichen-0079/YUVI](https://github.com/Ruichen-0079/YUVI)。

- 给参与开发的代理：先读 [`AGENTS.md`](AGENTS.md)。
- 开发周期：[`docs/ROADMAP.md`](docs/ROADMAP.md)
- 工作包：[`docs/P1.md`](docs/P1.md)、[`docs/P2.md`](docs/P2.md)、[`docs/P3.md`](docs/P3.md)、[`docs/P4.md`](docs/P4.md)、[`docs/P6.md`](docs/P6.md)（WP-A）、[`docs/P7.md`](docs/P7.md)（WP-B，验收中）、[`docs/P8.md`](docs/P8.md)（WP-C + WP-D，待实施）
- 事件与用语：[`docs/TERMS.md`](docs/TERMS.md)
- 记忆架构研究与依赖选型：[`docs/research/memory/`](docs/research/memory/README.md)
- V1 知识归档（历史、子系统的真实能力、工程教训、继承分类、来源）：[`docs/history/v1/`](docs/history/v1/README.md)
- 设计背景（只作参考）：[V2 蓝图，YUVI PR #339](https://github.com/Ruichen-0079/YUVI/pull/339)

当前能力（P8）：本地浏览器文字对话、流式回复、可选择的沉默、只追加 SQLite 档案、按日 token 用量，自动/手动快照、校验和恢复，以及自行整理经历和工具查档。

## 安装与运行

需要 **Node.js 22.16 或更新的 22.x**（使用内置 `node:sqlite`）及 npm。SQLite 在部分 Node 22 版本会输出实验性 API 提示。

```sh
npm ci
# 自行准备 UTF-8 人设文件，例如 ./persona.txt
export YUVI_DATA_DIR="$PWD/.local-data"
export YUVI_PERSONA_FILE="$PWD/persona.txt"
export YUVI_MODEL_BASE_URL="https://api.example.com/v1"
export YUVI_MODEL="your-model"
# 从自己的密钥管理方式设置 YUVI_MODEL_API_KEY，不要提交密钥。
npm start
```

### 多个 worktree 共用本机配置

可把 [`.env.example`](.env.example) 复制到仓库外的 `~/.config/yuvi-next/local.env`，在本机填写密钥与绝对路径，并执行 `chmod 600 ~/.config/yuvi-next/local.env`。Node 环境文件不会展开 `~` 或 `$HOME`。不要把真实配置、私人路径或密钥复制回仓库。

```sh
npm run start:local
# 可选：显式使用另一份外部配置
YUVI_LOCAL_ENV_FILE=/absolute/path/to/local.env npm run start:local
```

此命令先编译，再用 Node 22 内置环境文件加载能力启动同一服务；已导出的环境变量优先于文件。多个 worktree 默认读取同一外部文件；切换版本前停止使用相同数据目录的旧服务，实验时用环境变量覆盖独立数据目录、端口与人设。Unix 下配置文件必须不对组和其他用户开放（建议 0600）。

`npm start`、`npm test` 和快照/恢复命令保持原行为，**不会自动加载此文件**。例如浏览器测试仍需显式设置 `YUVI_CHROMIUM`；普通测试不会因此读取真实密钥或调用付费 API。维护命令需要的目录变量仍由调用者明确提供。

打开 <http://127.0.0.1:8787>。`npm start` 自动编译 TypeScript。同一数据目录只允许一个服务实例：启动时先取得数据目录内 `service.lock` 的独占使用权，再打开档案数据库、执行初始化和回合恢复；第二个实例会以 `YUVI_DATA_DIR is already in use` 拒绝启动，不写事件。正常退出或 `SIGKILL` 后操作系统会释放文件锁。`service.lock` 是由 SQLite 驱动持锁的协调文件，不存储事件；文件本身会保留，不能在服务运行期间删除或替换。重启不需要手动清理它。升级时先停止旧版本服务，再启动新版本；旧版本未使用此协调锁。不要将真实生活数据用于此开发分支。

档案仍使用普通 WAL 模式，各事件独立提交。独立进程可只读打开 `archive.sqlite`，读取 WAL 中的最新已提交数据，也可使用 SQLite 的 `VACUUM INTO` 或备份接口取得一致副本；这些连接不会争用服务锁。读取时保留同目录的 WAL/SHM，不要将仅复制主文件当作完整副本。服务锁使用独立 SQLite 连接，不增加运行时依赖或修改事件表结构。快照和恢复命令见下文。

| 环境变量 | 必填 / 默认 | 含义 |
| --- | --- | --- |
| `YUVI_DATA_DIR` | 必填 | 数据目录；数据库为 `archive.sqlite`，SQLite 可生成同目录 WAL/SHM 文件 |
| `YUVI_PERSONA_FILE` | 必填 | UTF-8 人设文件，启动时读取全文 |
| `YUVI_MODEL_BASE_URL` | 必填 | 包含 `/v1` 的 OpenAI 兼容基地址 |
| `YUVI_MODEL_API_KEY` | 必填 | API 密钥，假服务可用任意字符串 |
| `YUVI_MODEL` | 必填 | 模型名 |
| `YUVI_HOST` | `127.0.0.1` | 监听地址 |
| `YUVI_PORT` | `8787` | 监听端口 |
| `YUVI_CONTEXT_EVENTS` | `200` | 原文窗口及每批整理的事件数 N，正整数；包含 heard/said/silent，不计 attempt/error |
| `YUVI_CONTEXT_WRITING_CHARS` | `16000` | 近期内部文字的字数预算，按 JavaScript 字符串长度整条选入 |
| `YUVI_CONSOLIDATION_MAX_TOKENS` | `4000` | 整理请求的输出 token 上限 |
| `YUVI_CONSOLIDATION_IDLE_MS` | `3600000` | 最近对话事件之后的整理空闲阈值，毫秒 |
| `YUVI_OWNER_NAME` | `负责人` | 模型上下文中的负责人称呼，非空白文本 |
| `YUVI_MODEL_IDLE_TIMEOUT_MS` | `60000` | 等待响应及两次接收数据间的空闲上限（毫秒） |
| `YUVI_MODEL_MAX_DURATION_MS` | `600000` | 每次模型调用的总时长上限（毫秒） |
| `YUVI_SNAPSHOT_DIR` | `<YUVI_DATA_DIR>/snapshots` | 快照目录，真实路径不能等于数据目录 |
| `YUVI_SNAPSHOT_INTERVAL_MS` | `86400000` | 自动快照间隔，1–2147483647 整数毫秒 |

程序没有登录功能。默认仅监听本机。所有运行状态在数据目录中；人设是外部输入配置。模型默认空闲上限为 60 秒、总时长上限为 10 分钟；持续收到数据会重置空闲计时。两个超时变量须为 1–2147483647 的整数毫秒。超时会记录错误并继续处理下一回合。启动配置错误指出变量名，不输出变量值；不输出上游错误体、密钥或请求头。

## 接口与恢复

- `GET /health` → `{"ok":true}`。
- `POST /api/messages`，JSON `{"text":"你好"}` → SSE：`heard`（事件 ID）、`delta`（`{"text":"…"}`）、`done`（事件 ID）、`silent`（事件 ID）或 `error`（`{"message":"…"}`）。空白、非字符串及无效 JSON 返回 400。
- `GET /api/events?after=0` → 按 `seq` 升序返回全部后续事件。
- `GET /api/usage` → UTC 日期升序的按日汇总：`date`、`turns`、`turns_with_usage`、`prompt_tokens`、`completion_tokens` 和提供方的其他数值字段（嵌套字段按原层级求和；字符串和数组不求和）。无终结事件且无用量时返回 `[]`。
- `GET /` → 无框架网页，打开及刷新时载入历史。

消息按到达顺序入档并排队。每个回合在模型调用之前已有 `heard`，发送首块之前已有 `reply_attempt`，只有完整收到模型的 `[DONE]` 才写 `said`。模型错误保留已推送的片段。进程重启为所有未完成消息补记中断错误：未尝试发送为 `not_sent`，已尝试为 `unknown`，不补发。浏览器断开不取消生成，也不触发重试。历史页面会明确标出失败或中断。

每回合最多四次模型请求，前三次提供 `stay_silent`（可选字符串参数 `reason`）和 `check`，第四次只提供 `stay_silent`。模型可以查阅后继续回复；各步文字直接拼接、持续推送，只记一次发送尝试和一个回合结局。整回合无文本、最后一步仅调用有效的 `stay_silent` 时写 `act/silent`，网页显示“（没有回复）”，不展示理由。有文本时 `stay_silent` 被忽略并记入 `meta.ignored_tools`；`check` 仍会执行并继续。无文本、也没有有效沉默结局的完整流记错误（P4 对原空流行为的明确调整）。失败与中断不冒充沉默。

上下文保持档案的原始先后顺序，不构造问答配对。负责人消息带配置的称呼和本地可读日期时间（由 `TZ` 决定），它自己的消息只包含原话；末尾附带当前时间和完整原文引用，明确本回合回应对象。程序不把档案字段、编号和毫秒时间戳放进呈现文字；原文里的任何技术词汇、JSON 或格式都逐字保留，不过滤模型输出。

每次请求包含 `stream_options.include_usage=true`。提供方的 usage 原样记录一次：整理记在 `inner/wrote`，带查阅的一步记在该步的一条 `act/checked`，最后一步记在终结事件；失败整理不入档，其用量不计。缺失用量不估算；已收到用量后断流的对话请求将用量记在 error。`/api/usage` 按事件 UTC 日期合计所有事件的数值用量；`turns` 和 `turns_with_usage` 仍只统计 said/silent/error，不计算金额。对话失败带 `request_chars`（失败请求所有消息 content 的字符串长度之和），非 2xx 响应另带 `http_status`，不保存上游错误体。

## 整理与查档

空闲达到阈值且没有进行中或排队的回合时，服务按档案顺序分批整理尚未整理的经历；原文窗口受到压力时，也会在下一次对话请求前整理。每批最多 N 个对话事件，不包含未结束回合及其后面的事件。整理没有工具，由模型自行决定写什么、写多少，正常结束时全文原样记录为 `inner/wrote`，包括空输出和因长度停止的文字。整理与对话串行，整理期间到达的消息立即入档并排队。

整理失败不写事件，以固定信息报告，非 2xx 包含状态码；同一运行进程失败后等待至少 30 秒再尝试，对话在退避期间继续。已结束但尚未整理的事件超过 2N 时，在下一次对话请求前将最早 N 个移出窗口，并用 `control/unconsolidated` 记录范围和原因。这些事件仍保存在档案中、可查阅。否则，未经整理的事件不会离开窗口。稳定窗口以一整个窗口为步长前进；整理进度和窗口从档案重新计算，重启及快照恢复不丢失进度。

每次对话和整理都按字数预算放入最近的非空内部文字：从最新往前整条选择，遇到放不下的下一条即停止，再按时间顺序呈现。最新一条无论长短总是完整放入；长度停止的说明位于原文之外。它们属于档案，**页面不显示**，负责人可用 `/api/events` 或只读档案查阅；未选入的旧文字仍可通过 `check` 找到。这是自行整理的文字载体，不是完整记忆或 recall。

模型可调用 `check({query?, from?, to?})`：查阅本分支、本场景的对话和非空内部文字。P8 使用可重建的 FTS5 派生索引，按规范化的字词匹配，大小写和全角字符会规范化；按相关度选出、按档案顺序呈现。最相关的一条和最近的一条始终整条返回，其余受最多 40 条、16000 字预算限制，不截断单条。时间为 ISO 日期或日期时间，包含端点；无时区按主机本地时区，单独日期表示当地午夜。没有查询时按最近记录选取；查询只有符号、索引正在建立或不可用时，保留原有区分大小写的子串扫描，工具结果明确说明降级原因、词语裁剪和选取方式。

每次调用记录 `act/checked`，包括候选排名与实际返回的引用，两者分开记录。无效参数如实记录并返回说明，不执行查询。网页不展示查阅与控制事件。

**查得到不等于被纠正。** 更正与旧说法都原样保留，符合条件时一起返回；程序不判断哪条正确，不保证模型会查、会相信或采用更正。各部分按事件数或字数有界，但不保证整个请求能放进模型上下文；超限如实失败，不裁剪重发。

三个新增数值变量均为 1–2147483647 的整数。大窗口和长文字会增加请求用量；默认空闲整理会实际调用配置的模型。

## 快照、校验与恢复

服务启动时若没有快照或最近快照已过间隔，会生成一份；之后按间隔继续生成。自动快照在独立进程中读取档案，对话可以继续。启动时快照目录不可用会报告 YUVI_SNAPSHOT_DIR 并拒绝启动；运行中失败只报告固定信息，并在下次检查时重试，不停止对话。没有自动删除或保留清理策略。

~~~sh
# 手动快照：只需 YUVI_DATA_DIR，可选 YUVI_SNAPSHOT_DIR，无需模型配置
npm run snapshot
# 成功输出 .sqlite 路径；保留旁边同名的 .sqlite.json 清单
npm run verify-snapshot -- /absolute/path/to/snapshot.sqlite
# 校验成功输出事件数和最大 seq；损坏、缺清单、结构或触发器不匹配时非零退出
~~~

快照包含 WAL 中已提交内容，服务运行、回合生成中都可执行。文件名含 UTC 时间，清单含 SHA-256 和事件边界。目录权限0700，文件0600；已有快照目录会收紧为0700。未完成临时目录（.building-*）或缺清单的文件不能作为有效快照使用。进程被杀可能留下这些临时文件，不会自动删除，也不会覆盖已发布快照。不要仅复制运行中档案的主文件而遗漏 WAL。

一次完整恢复：

1. 停止原服务；保留原数据目录和快照，不要覆盖或删除。
2. 对选中的快照运行 npm run verify-snapshot -- <file>。
3. 选择全新或空的数据目录（父目录须已存在，不使用符号链接目标）：

   ~~~sh
   npm run restore -- /absolute/path/to/snapshot.sqlite /absolute/path/to/new-data
   ~~~

4. 恢复命令不需要模型配置；校验失败或目标非空时拒绝写入。恢复后历史逐列保留，并追加一条 control/restored，记录快照SHA及边界。快照、原目录不修改，也不取得其服务锁。
5. 将 YUVI_DATA_DIR 改为新目录，另行配置人设、模型与密钥，再运行 npm start。快照只包含档案，**不包含人设文件、模型配置或密钥**。
6. **恢复后不要再用旧目录启动同一条生活。** 若快照含生成中的回合，启动会补记中断，不重发；快照之后原目录里的事件不会凭空出现在新目录。

启动时会只读检查已有档案及表/触发器；损坏时提示 YUVI_DATA_DIR 和从快照恢复，不修复、不自动覆盖。维护命令和自动快照不访问 service.lock，单实例保护仍由既有机制负责。

## 测试

```sh
npm test
# 若已安装 Chromium，额外启用浏览器验收（没有设置时此项明确跳过）
YUVI_CHROMIUM=/absolute/path/to/chromium npm test
# Linux 可隔离外部网络；需在新命名空间启用回环设备
unshare -rn sh -c 'ip link set lo up; npm test'
```

测试自建回环地址假模型，不访问真实模型或外部网络；P2 检查含真实进程的 40 秒流，整套测试约两分钟（含真实 30 秒整理退避）。覆盖沉默、工具分块、回合锚定、两种超时、原始用量与按日汇总、配置错误，以及 P1 的持久化、上下文、只追加、HTTP 错误、流断开、超时、串行排队、空输入、密钥卫生和真实 `SIGKILL` 后恢复。另用多个真实服务进程检查同目录拒绝启动、六进程同时竞争、路径别名、退出释放、旧 WAL 档案兼容性，以及独立只读进程读取实时 WAL 和创建一致副本时的互斥保证。浏览器验收检查增量显示、中性的沉默标记，以及刷新后的历史。`npm ci` 需要下载开发依赖；不自动下载浏览器。

P3 专项还覆盖实时 WAL 快照、恢复拒绝与空目录发布、字节损坏与触发器校验、损坏档案启动时不变，以及10万事件下10次真实 SIGKILL 的发布原子性。

P4 专项使用真实服务进程覆盖空闲和压力整理、空文字、失败退避、积压移出记录、稳定窗口和重启、整条文字预算、check 原文与日期查询、多步结局及 SIGKILL、逐次用量、原文/呈现隔离、旧 P3 可执行程序生成的档案及快照恢复。浏览器验收还检查内部文字、查阅和积压事件不显示。

## 档案规模与性能验证（P6）

回合、整理和空闲检查使用从档案重建的数字元数据及按序号读取的有限原文，不缓存历史内容。重启仍执行原有完整性检查，再重建进度；不新增档案索引或持久状态文件。场景和分支仍固定为原有值，不增加配置。

`check` 仍为区分大小写的子串查询，预算与原文呈现不变；匹配总数需要 SQLite 扫描。启动、`/api/events`、`/api/usage` 及快照校验的既有规模成本未在本轮消除。实现选择、实测数字和限制见 [P6 实测说明](docs/notes/P6.md)。

从仓库根目录运行（Node 22；本地 Git 历史须包含基线 `190a272`；脚本不联网、不加载本机模型凭据）：

```sh
npm run build
# 生成器：全新文件，事件数、typical/empty 形态、种子
node scripts/p6/generate.mjs /tmp/yuvi-synthetic.sqlite 1000000 typical 67
# 一条命令完成两种百万形态、旧版对照、F5 指标和 F6 恢复测试
# scratch 路径必须尚不存在；结果及原始计时写入其中的 results.json
unshare -rn sh -c 'ip link set lo up; node scripts/p6/benchmark.mjs /tmp/yuvi-p6-run'
```

所有服务使用回环假模型和独立数据目录。百万事件检查不加入 `npm test`；普通测试运行同一生成器的两万事件检查、新旧纯函数差分和真实进程跨版本对照。保留的 [实测 JSON](docs/notes/P6-results.json) 包含各回合计时与查询计划。


## 呈现记录与只读诊断（P7）

每次对话、工具后续步骤及整理请求组装完成后，程序在调用模型之前追加 `control/presented`。它记录来源范围、消息数量/字数、请求参数、规则版本、人设及消息摘要；只证明“已组装、即将交给请求发送”，不证明服务收到或模型使用了内容。工具后续步骤继承第 0 步的原始基础消息，追加本步工具往返，并各自记录组装时间。

先运行一次 `npm run build`，然后指定要检查的数据目录；无需模型地址或 API 密钥。诊断命令不自动编译、不加载本机凭据、不写档案事件、不取得服务锁，可以在服务运行时读取已提交 WAL：

```sh
YUVI_DATA_DIR=/tmp/yuvi-data npm run --silent presented -- summary
YUVI_DATA_DIR=/tmp/yuvi-data npm run --silent presented -- writings
YUVI_DATA_DIR=/tmp/yuvi-data YUVI_PERSONA_FILE=/tmp/persona.txt npm run --silent presented -- show 42 --messages
# 等价的直接入口：node dist/maintenance.js presented summary
```

三个命令输出 JSON。`summary` 汇总清单数量、用途/步骤/结局、时间及 meta 字节数；`writings` 按请求统计每条非空文字的呈现次数和完成次数，给出从未有记录的条数。P7 之前的请求没有记录，不按规则推测它们曾呈现过什么。

`show` 按历史范围和 `previous` 链重建消息，以 SHA-256 核对。成功为 `exact`；人设缺失/不同为 `persona_mismatch`，Node 主版本不同为 `node_mismatch`，未知规则为 `rules_unsupported`，有效 IANA 时区未记录（缺失、无效或 `null`）为 `time_zone_unrecorded`，其余来源/摘要无法核对为 `mismatch`。它只核验 messages；工具描述等未逐条保存的常量不能被扩大声称为任意历史版本 HTTP 请求的精确副本。结局从后续事件推导：`completed`、`failed`、`unknown` 或整理的 `incomplete`；失败的 reason/outcome/http_status 沿用实际 error。

运行时时间文字沿用 P6 的原生 Date 行为，不依赖时区名字；可用的 IANA 名仅供历史重建，不可用时明确记录 `time_zone: null`。工具后续步骤的基础时间仍取第 0 步。

源数据边界：仅当重建摘要不符、且档案当前 `heard` 含 U+FFFD 时报告 `source_lossy`。这表示可能的源数据损失，不能证明原输入含孤立 UTF-16 代理项，也不能排除实现缺陷。真实 U+FFFD、NUL、emoji 的正常请求仍应精确重建；P7 不改写输入或旧档案。Node 22 的 NUL 读回差异通过区分当前回合指示与历史窗口处理。

诊断按逻辑只读执行：不改变事件、主库、空闲 WAL 的已提交内容或服务锁。原生 SQLite 可以创建 WAL/SHM，或维护 SHM 协调字节；这不表示诊断写入了档案事实。运行中和关闭后的目录均有检查，并验证随后服务仍能正常对话。

离线性能与存储复现（全新 scratch 目录，Node 22.23.3；分项插桩使用其内置 registerHooks）：

```sh
unshare -rn sh -c 'ip link set lo up; node scripts/p6/benchmark.mjs /tmp/yuvi-p7-run --p7 1'
# 单独生成带呈现记录的形态：
node scripts/p6/generate.mjs /tmp/yuvi-presented.sqlite 1000000 presented 67
```

脚本复用 P6 两种档案，在真实服务入口比较 P6 与 P7；另生成带呈现记录的百万档案测量只读诊断。它只使用回环假模型，保留 results.json 和合成数据。[实施说明](docs/notes/P7.md)、[原始性能数据](docs/notes/P7-results.json)。


## 派生索引与离线生活评测（P8）

`index.sqlite` 与 SQLite 的协调文件仅保存词元倒排和结构元数据，不能作为第二份原文档案；结果始终从 `archive.sqlite` 读取。索引敏感程度与档案相同，文件权限不宽于 0600，不进入快照。启动时校验，不符则重建；运行中追平，失败不阻止对话。重建及扫描降级在工作线程执行；扫描按发起时的档案位置读取一致前缀。

```sh
npm run build
YUVI_DATA_DIR=/tmp/yuvi-data npm run --silent index -- verify
YUVI_DATA_DIR=/tmp/yuvi-data npm run --silent index -- verify --full
# 必须先停服务；重建取得现有服务锁，在目录内临时文件建立后原子替换。
YUVI_DATA_DIR=/tmp/yuvi-data npm run --silent index -- rebuild
```

`verify` 逻辑只读，可在线执行；结果为 ok、behind、version、mismatch、corrupt、missing 或 unsupported。低于 Node 22.16、没有 FTS5 时仍能启动并退回扫描，但完整功能与验收要求使用 22.16 以上的 22.x。

评测只使用冻结的合成生活、模拟时钟和回环假模型，不加载本机密钥，不调用真实模型。新输出目录必须不存在：

```sh
npm run eval -- run life-a --arm A2 --out /tmp/yuvi-life-a
npm run eval -- measure /tmp/yuvi-life-a
npm run eval -- explain /tmp/yuvi-life-a P04
npm run eval -- baseline
npm run eval -- regress
```

baseline 运行完整九周的八种生活/臂/写作组合，生成基线 JSON 与报告；regress 重跑并逐字节比较冻结 JSON。墙钟与文件大小另存 timing.json，不参与确定性比较。数据保留在忽略的独立评测目录中。结果只能说明检索与呈现，不能证明假模型理解或使用了记忆。
