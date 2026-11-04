# P9 离线证据（2026-11-04）

仅合成档案与回环假模型；未使用真实凭据、外部模型、Alice 或 V1 私人数据。

- `million.json` / `million-run.txt`：两种百万形态的原始计时、采样、查询计划、返回 seq、启动和 RSS。
- `p8-default-million.json`：默认 recall 开、浮现关的 P8 百万门槛复测；旧字段 service.p8 代表当前 P9 运行时。
- `p8-default-summary.json`：上项的可读提取；R17 的 1.25 比值实际通过，原驱动遗留的 threshold_status 文字不代替本次正式门槛判断。
- `manifest-size-conflict.txt`：合法长词与清单字节上限的实际冲突，等待规格裁定。

完整基线两次运行、最终回归和请求审计的证据在完成后补充。被中断的运行保留在本机，不计入通过数。
