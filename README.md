# YUVI_NEXT

YUVI V2 的 P1：本地浏览器文字对话、流式回复和只追加的 SQLite 档案。

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

打开 <http://127.0.0.1:8787>。`npm start` 自动编译 TypeScript。每个数据目录只运行一个进程；不要将真实生活数据用于此开发分支。

| 环境变量 | 必填 / 默认 | 含义 |
| --- | --- | --- |
| `YUVI_DATA_DIR` | 必填 | 数据目录；数据库为 `archive.sqlite`，SQLite 可生成同目录 WAL/SHM 文件 |
| `YUVI_PERSONA_FILE` | 必填 | UTF-8 人设文件，启动时读取全文 |
| `YUVI_MODEL_BASE_URL` | 必填 | 包含 `/v1` 的 OpenAI 兼容基地址 |
| `YUVI_MODEL_API_KEY` | 必填 | API 密钥，假服务可用任意字符串 |
| `YUVI_MODEL` | 必填 | 模型名 |
| `YUVI_HOST` | `127.0.0.1` | 监听地址 |
| `YUVI_PORT` | `8787` | 监听端口 |
| `YUVI_CONTEXT_EVENTS` | `200` | 最近对话事件数，正整数；不计 attempt/error |

程序没有登录功能。默认仅监听本机。所有运行状态在数据目录中；人设是外部输入配置。每次模型请求总超时为 30 秒，超时会记录错误并继续处理下一回合。启动配置错误及模型错误只输出固定消息，不输出上游错误体、密钥或请求头。

## 接口与恢复

- `GET /health` → `{"ok":true}`。
- `POST /api/messages`，JSON `{"text":"你好"}` → SSE：`heard`（事件 ID）、`delta`（`{"text":"…"}`）、`done`（事件 ID）或 `error`（`{"message":"…"}`）。空白、非字符串及无效 JSON 返回 400。
- `GET /api/events?after=0` → 按 `seq` 升序返回全部后续事件。
- `GET /` → 无框架网页，打开及刷新时载入历史。

消息按到达顺序入档并排队。每个回合在模型调用之前已有 `heard`，发送首块之前已有 `reply_attempt`，只有完整收到模型的 `[DONE]` 才写 `said`。模型错误保留已推送的片段。进程重启为所有未完成消息补记中断错误：未尝试发送为 `not_sent`，已尝试为 `unknown`，不补发。浏览器断开不取消生成，也不触发重试。历史页面会明确标出失败或中断。

## 测试

```sh
npm test
# 若已安装 Chromium，额外启用浏览器验收（没有设置时此项明确跳过）
YUVI_CHROMIUM=/absolute/path/to/chromium npm test
# Linux 可隔离外部网络；需在新命名空间启用回环设备
unshare -rn sh -c 'ip link set lo up; npm test'
```

测试自建回环地址假模型，不访问真实模型或外部网络；覆盖持久化、上下文、只追加、HTTP 错误、流断开、超时、串行排队、空输入、密钥卫生和真实 `SIGKILL` 后恢复。浏览器验收检查未完成时增量已显示，以及刷新后的历史。`npm ci` 需要下载开发依赖；不自动下载浏览器。
