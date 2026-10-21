# YUVI_NEXT

YUVI 的第二代（V2）。一个持续运行的人工个体：发生的事按时间写进只追加的档案，可替换的语言模型阅读档案来生活。V1 与研究历史在 [Ruichen-0079/YUVI](https://github.com/Ruichen-0079/YUVI)。

- 给参与开发的代理：先读 [`AGENTS.md`](AGENTS.md)。
- 开发周期：[`docs/ROADMAP.md`](docs/ROADMAP.md)
- 工作包：[`docs/P1.md`](docs/P1.md)、[`docs/P2.md`](docs/P2.md)、[`docs/P3.md`](docs/P3.md)、[`docs/P4.md`](docs/P4.md)（规划中）
- 事件与用语：[`docs/TERMS.md`](docs/TERMS.md)
- 设计背景（只作参考）：[V2 蓝图，YUVI PR #339](https://github.com/Ruichen-0079/YUVI/pull/339)

当前能力（P3）：本地浏览器文字对话、流式回复、可选择的沉默、只追加 SQLite 档案、按日 token 用量，以及自动/手动快照、校验和恢复。

## 安装与运行

需要 **Node.js 22.13 或更新的 22.x**（使用内置 `node:sqlite`）及 npm。SQLite 在部分 Node 22 版本会输出实验性 API 提示。

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
| `YUVI_CONTEXT_EVENTS` | `200` | 最近对话事件数，正整数；包含 heard/said/silent，不计 attempt/error |
| `YUVI_MODEL_IDLE_TIMEOUT_MS` | `60000` | 等待响应及两次接收数据间的空闲上限（毫秒） |
| `YUVI_MODEL_MAX_DURATION_MS` | `600000` | 每次模型调用的总时长上限（毫秒） |
| `YUVI_SNAPSHOT_DIR` | `<YUVI_DATA_DIR>/snapshots` | 快照目录，真实路径不能等于数据目录 |
| `YUVI_SNAPSHOT_INTERVAL_MS` | `86400000` | 自动快照间隔，1–2147483647 整数毫秒 |

程序没有登录功能。默认仅监听本机。所有运行状态在数据目录中；人设是外部输入配置。模型默认空闲上限为 60 秒、总时长上限为 10 分钟；持续收到数据会重置空闲计时。两个超时变量须为 1–2147483647 的整数毫秒。超时会记录错误并继续处理下一回合。启动配置错误指出变量名，不输出变量值；不输出上游错误体、密钥或请求头。

## 接口与恢复

- `GET /health` → `{"ok":true}`。
- `POST /api/messages`，JSON `{"text":"你好"}` → SSE：`heard`（事件 ID）、`delta`（`{"text":"…"}`）、`done`（事件 ID）、`silent`（事件 ID）或 `error`（`{"message":"…"}`）。空白、非字符串及无效 JSON 返回 400。
- `GET /api/events?after=0` → 按 `seq` 升序返回全部后续事件。
- `GET /api/usage` → UTC 日期升序的按日汇总：`date`、`turns`、`turns_with_usage`、`prompt_tokens`、`completion_tokens` 和提供方的其他数值字段（嵌套字段按原层级求和；字符串和数组不求和）。无终结事件时返回 `[]`。
- `GET /` → 无框架网页，打开及刷新时载入历史。

消息按到达顺序入档并排队。每个回合在模型调用之前已有 `heard`，发送首块之前已有 `reply_attempt`，只有完整收到模型的 `[DONE]` 才写 `said`。模型错误保留已推送的片段。进程重启为所有未完成消息补记中断错误：未尝试发送为 `not_sent`，已尝试为 `unknown`，不补发。浏览器断开不取消生成，也不触发重试。历史页面会明确标出失败或中断。

每次模型请求提供 `stay_silent` 工具（可选字符串参数 `reason`），由模型自行选择。完整流仅调用该工具且没有文本时，写入 `act/silent`，不写发送尝试；网页显示“（没有回复）”，不展示理由。若有文本则文本优先，按 P1 写入 `said` 并记录 `meta.ignored_tools`；无文本、无工具的完整流仍写空 `said`。无效工具输出与失败不冒充沉默，重启也不会为已沉默的回合补记错误。

上下文保持档案的真实 `seq` 顺序，包含沉默的事实；末尾追加临时回合指示来标明当前回应哪条消息，不重排历史，也不将回合指示写入档案。

请求包含 `stream_options.include_usage=true`。提供方返回的 usage 对象原样记在终结事件的 `meta.usage`，缺失时不估算；即使收到 usage 后断流，也将该用量记入 error。用量按终结事件的 UTC 日期汇总，包含旧 P1 回合数，不计算金额。

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

测试自建回环地址假模型，不访问真实模型或外部网络；P2 检查含真实进程的 40 秒流，整套测试约一分钟。覆盖沉默、工具分块、回合锚定、两种超时、原始用量与按日汇总、配置错误，以及 P1 的持久化、上下文、只追加、HTTP 错误、流断开、超时、串行排队、空输入、密钥卫生和真实 `SIGKILL` 后恢复。另用多个真实服务进程检查同目录拒绝启动、六进程同时竞争、路径别名、退出释放、旧 WAL 档案兼容性，以及独立只读进程读取实时 WAL 和创建一致副本时的互斥保证。浏览器验收检查增量显示、中性的沉默标记，以及刷新后的历史。`npm ci` 需要下载开发依赖；不自动下载浏览器。

P3 专项还覆盖实时 WAL 快照、恢复拒绝与空目录发布、字节损坏与触发器校验、损坏档案启动时不变，以及10万事件下10次真实 SIGKILL 的发布原子性。
