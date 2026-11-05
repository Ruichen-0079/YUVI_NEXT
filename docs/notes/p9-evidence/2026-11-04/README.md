# P9 离线证据（2026-11-04）

仅合成档案与回环假模型，未使用真实凭据、外部模型、Alice 或 V1 私人数据。所有记录的输出目录均为合成数据目录。

## 回归与请求

- `test-node22.16.txt` / `test-node22.22.txt`：各195/195完整离线回归，包含 Chromium、真实服务进程、SIGKILL、索引故障、恢复和旧数据兼容。
- `p9-tests-only.txt`：新增46项独立运行，14.73秒。
- `baseline-run.txt`：完整63天八组合，含一次完整 P8 regress，21.91分钟。
- `baseline-reaccount.txt`：在原始档案上使用最终独立统计重算，不重放模型，不改事件。保留 P8 原有 overlap/check rank，新增 recall_rank；同时间戳按 seq 判定回声，组装前写下的文字可经原有前景呈现，浮现候选仍严格在 heard 之前。
- `regress-run.txt`：最终统计口径的八组合完整复跑，显式复用已逐字节验证的 P8 回归，13.61分钟。不是以重算代替模型驱动复跑。
- `determinism.json`：各组合 metrics.json、规范化档案摘要和实际请求摘要轨迹的逐字节一致性；每轮52,900次请求。
- `request-digests.json.gz`：首轮每次回环提供方收到的真实消息摘要与 seq，附各臂 run/timing。gzip mtime=0；没有消息正文副本。
- `request-audit.json`：首轮52,900次 messages 全部实测精确重建、37,998次浮现选择独立核对、68次索引 recall 排名核对。复跑的请求轨迹与规范化档案完全相同，未重复逐条调用 show。只证明 messages，不扩大为任意历史 HTTP 请求的逐字节重建。

P8 `regress` 真正执行后，P9 可显式复用其目录；命令先验证 baseline.json 与冻结文件逐字节相同。所有墙钟记录不进入确定性 JSON。中断的长跑与常规最终长跑分开保留，不把半次运行计为通过。

## 性能与范围

- `million.json` / `million-run.txt`：百万 writings、varied 的原始采样、查询计划、返回 seq、启动、RSS与索引大小。
- `p8-default-million.json` / `p8-default-summary.json`：默认 recall on、surfacing off 的 P8 全部强制百万门槛复测。旧字段 service.p8 代表当前 P9 运行时。
- `scope-query-retest.json`：增加有界 rank 来源核对后，重测11个W与30个R；每查询20次，保留扫描对照，阈值全部通过。
- `million-scope.txt`：三个百万派生索引逐行核对来源场景、分支、种类与时间，invalid=0。
- 原驱动 `threshold_status` 是 P8 遗留文字；本次 R17 1.25 倍门槛实际通过，不以该文字降低正式要求。

机器为 Core Ultra 9 275HX（24逻辑CPU）、Node22.22.0；与 Claude 的验收环境不同。细节和限制见 [P9-performance.md](../../P9-performance.md)。

## 历史规格冲突证据（已裁定）

- `manifest-size-conflict.txt`：合法长词的最小组装见证，5,778字节。
- `manifest-boundary-process.txt`：实际服务接受5,000字符单词，回合正常完成，清单5,786字节，超过 C7 的2,500。不是普通失败或输入截断。

以上为旧开发构建的历史观察，不是最终验收状态。`baa2d6d` 已明确结构/完整字节边界并修正固定提示语；修订后的全量回归、九周基线和逐条重建见 [2026-11-05](../2026-11-05/README.md)。本目录的百万事件、故障恢复与 P8 兼容证据按裁定继续有效。

## 复现

固定对应 Node 和 Chromium 后：

```sh
unshare -rn sh -c 'ip link set lo up; npm test'
unshare -rn sh -c 'ip link set lo up; npm run eval -- baseline-p9'
# 使用上一条输出 timing.json 中的 p8_root：
unshare -rn sh -c 'ip link set lo up; npm run eval -- regress-p9 --p8-regress-dir <p8_root>'
node scripts/p9/audit.mjs <某一完整生活/臂目录>
node scripts/p9/verify-scope.mjs <合成数据目录>
unshare -rn sh -c 'ip link set lo up; node scripts/p9/manifest-boundary.mjs'
```

全部长期档案保留在本机 `.local-data/`。新环境按命令生成独立新目录；不得使用真实生活或私人档案。
