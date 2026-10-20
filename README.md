# YUVI_NEXT

YUVI 的第二代（V2）。一个持续运行的人工个体：发生的事按时间写进只追加的档案，可替换的语言模型阅读档案来生活。V1 与研究历史在 [Ruichen-0079/YUVI](https://github.com/Ruichen-0079/YUVI)。

- 给参与开发的代理：先读 [`AGENTS.md`](AGENTS.md)。
- 开发周期：[`docs/ROADMAP.md`](docs/ROADMAP.md)
- 工作包：[`docs/P1.md`](docs/P1.md)、[`docs/P2.md`](docs/P2.md)
- 事件与用语：[`docs/TERMS.md`](docs/TERMS.md)
- 设计背景（只作参考）：[V2 蓝图，YUVI PR #339](https://github.com/Ruichen-0079/YUVI/pull/339)

当前能力（P2）：本地浏览器文字对话、流式回复、可选择的沉默、只追加 SQLite 档案与按日 token 用量。

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

打开 <http://127.0.0.1:8787>。`npm start` 自动编译 TypeScript。同一数据目录只允许一个服务实例：启动时先取得 `archive.sqlite` 的独占使用权，再执行初始化和回合恢复；第二个实例会以 `YUVI_DATA_DIR is already in use` 拒绝启动，不写事件。正常退出或 `SIGKILL` 后操作系统会释放文件锁，无需删除锁文件。不要将真实生活数据用于此开发分支。

服务运行期间，外部 SQLite 连接（包括只读连接）也会被独占锁阻止；查看历史和用量请使用 HTTP 接口。直接用 SQLite 检查档案时先停止服务。锁由现有数据库连接持有，各事件仍独立提交，未改为长事务；不新增锁文件、数据库或运行时依赖。

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

## 测试

```sh
npm test
# 若已安装 Chromium，额外启用浏览器验收（没有设置时此项明确跳过）
YUVI_CHROMIUM=/absolute/path/to/chromium npm test
# Linux 可隔离外部网络；需在新命名空间启用回环设备
unshare -rn sh -c 'ip link set lo up; npm test'
```

测试自建回环地址假模型，不访问真实模型或外部网络；P2 检查含真实进程的 40 秒流，整套测试约一分钟。覆盖沉默、工具分块、回合锚定、两种超时、原始用量与按日汇总、配置错误，以及 P1 的持久化、上下文、只追加、HTTP 错误、流断开、超时、串行排队、空输入、密钥卫生和真实 `SIGKILL` 后恢复。另用多个真实服务进程检查同目录拒绝启动、六进程同时竞争、路径别名、退出释放与旧 WAL 档案兼容性。浏览器验收检查增量显示、中性的沉默标记，以及刷新后的历史。`npm ci` 需要下载开发依赖；不自动下载浏览器。
