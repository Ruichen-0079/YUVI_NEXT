# P9 正式裁定后的最终证据（2026-11-05）

整合 Claude 的 `baa2d6d`，只改运行时固定提示语，不改变检索、选择或存储语义。全程离线、回环假提供方、独立合成数据；没有真实模型 API、凭据、其他 AI 会话或私人生活档案。

- `test-node22.16.txt` / `test-node22.22.txt`：最终完整 `npm test` 各197/197，0失败、0跳过，包含 Chromium、进程级 P8 差分、中断、恢复及旧数据兼容。
- `p9-tests-only.txt`：P9 专项48/48，15.14秒；`corpus-cap.txt`：W/S 定向完整清单大小检查。
- `boundary-process.txt`：实际服务入口的两个长词用例。5000字母词：完整/结构5,786/786字节；33个3000字母词：完整/结构96,882/882字节。terms按独立P8规则逐字核对，回合done，没有长度异常；两个show均exact。`no_candidates`是空的先前档案所致。
- `baseline-regress-run.txt` / `determinism.json`：重新模拟两段63天生活、8组合各两次。JSON、metrics、完整规范化档案与实际请求摘要轨迹逐字节一致。墙钟不参与确定性报告。
- `request-audit.json`：两轮分别逐条调用现有 `presented show`，各52,900条。共105,800次精确重建，另独立核对候选、排除、选入及recall排名；不以第二轮的确定性推断代替实际show。
- `request-digests.json.gz`：提供方接收时核对已提交的清单，保存每次实际请求的消息摘要及seq。两轮轨迹完全相同，只存一份轨迹，并保留两轮运行时间；gzip mtime=0。没有消息正文副本。
- `ruling-comparison.json`：修订前与修订后的逐事件比较，只允许浮现段、请求总字数各少2字及相应摘要/假用量变化。完整映射UUID引用，不忽略其他字段；研究覆盖、渠道、排名、候选、排除、遗漏与回声完全相同。字符统计另从原始事件独立计算。

正式基线哈希、两轮时间与完整自查见 [P9-self-check.md](../../P9-self-check.md)。结构字节仅把surfacing.terms/dropped中的每个字符串置空，再计算JSON UTF-8大小。完整清单最大1,468字节；结构字节最大1,282；长输入没有完整大小硬门槛，检索词不截断、不省略。

## 沿用证据

按正式裁定，沿用 [2026-11-04](../2026-11-04/README.md) 的百万 writings/varied、P8默认模式性能、扫描比值、查询计划、范围核对、故障恢复与P8完整regress。此次没有重跑百万研究，也不把旧采样报告成新测量。P8回归目录先与冻结JSON逐字节校验后复用。

旧提示语只存在于未发布的开发构建，旧合成档案保持原样。用当前规则重建旧浮现消息应报告mismatch，不设兼容分支。旧的大小冲突文件仅作历史证据，不再代表当前阻塞。

## 复现

固定Node22.16或22.22及Chromium；正式基线与show使用Node22.22。每轮单独保留新目录：

```sh
unshare -rn sh -c 'ip link set lo up; npm test'
unshare -rn sh -c 'ip link set lo up; node scripts/p9/manifest-boundary.mjs'
unshare -rn sh -c 'ip link set lo up; node eval/cli.mjs baseline-p9 --p8-regress-dir <已验证P8目录>'
unshare -rn sh -c 'ip link set lo up; node eval/cli.mjs regress-p9 --p8-regress-dir <已验证P8目录>'
# 没有P8目录时省略该参数，会实际执行完整P8 regress。
# 对两轮的每个完整生活/臂目录分别执行：
node scripts/p9/audit.mjs <生活臂目录>
node scripts/p9/compare-ruling.mjs <旧开发基线> <新基线> <新regress>
```

长跑档案与手动边界数据均保留在忽略的 `.local-data/`。只读诊断允许SQLite正常WAL/SHM协调，不修改档案事件或服务锁。假模型结论仅限检索与呈现，不证明理解、采用、主动回想或真实费用。
