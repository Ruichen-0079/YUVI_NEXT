# P9 九周合成生活基线

只报告检索与呈现。假模型由脚本决定工具调用，excerpt 是固定摘抄；不能证明模型注意、理解、采用旧文字，也不能说明真实模型会调用 recall 或其文字会携带答案。两段生活与 P8 字节相同，P8 regress 已实际逐字节通过。

## 答案呈现与代价

| 臂 | life-a | life-b | 机制 |
| --- | ---: | ---: | --- |
| A0 | 7/38 | 0/38 | 无工具 |
| A2 | 37/38 | 28/38 | check |
| E-R | 36/38 | 23/38 | recall |
| E-S | 26/38 | 20/38 | 相关度浮现 |
| E-SR | 16/38 | 7/38 | 新近浮现 |
| E-SC | 38/38 | 31/38 | 相关度浮现 + check |

相对无工具基线的增益不能解释成理解或更可靠的事实记忆。单独 recall 与浮现仍有遗漏，不能取代 check；F8 的长文尾部没有摘抄携带者，换说法也仍可能失败。高频生活中的呈现明显更困难。

相关度浮现在非探针回合的发生率是 life-a 93.98%、life-b 98.79%。这是大量额外内容进入上下文，不能称为有用回忆。规划模拟额外要求最低 DF 大于零，正式规格没有该门槛；本实验保持正式规则，没有为接近规划的浮现率而筛掉线索。

## 假设（呈现层）

- H1-o：**supported**；[{"life":"life-a","p8":0,"p9":0.9354838709677419},{"life":"life-b","p8":0,"p9":0.5806451612903226}]。本次冻结判据的推翻条件未成立。
- H2-a：**supported**；[{"life":"life-a","p8":0.18421052631578946,"p9":0.6842105263157895},{"life":"life-b","p8":0,"p9":0.5263157894736842}]。本次冻结判据的推翻条件未成立。
- H2-b：**supported**；{"older_than_1d":38,"total_gain":39}。本次冻结判据的推翻条件未成立。
- H2-c：**supported**；{"nonprobe_rate":0.9878909229595728,"echo":{"occurrences":1270,"ratio":0.04086097615906824}}。本次冻结判据的推翻条件未成立。
- H2-d：**supported**；[{"life":"life-a","relevance":0.5454545454545454,"recency":0.2727272727272727},{"life":"life-b","relevance":0.45454545454545453,"recency":0}]。本次冻结判据的推翻条件未成立。
- H2-e：**supported**；[{"life":"life-a","p8":0.9736842105263158,"p9":1},{"life":"life-b","p8":0.7368421052631579,"p9":0.8157894736842105}]。本次冻结判据的推翻条件未成立。

H1-o 的工具由脚本在探针时必定调用，不证明自主回想；H2 的增益并不否定噪声、回声和预算消费。逐次增益及旧答案年龄保存在 JSON，不作选择性删改。

## 两段生活的浮现统计

每回合字数含浮现消息的固定文字和时间，未浮现计零。回声按实际档案顺序判定；同一时间戳的较早探针仍可能被后来的文字摘抄。相邻重复率的分母是全部相邻回合对。非携带者字数是探针中不携带任何目标答案的整段文字字数。

### E-S

| 指标 | life-a | life-b |
| --- | --- | --- |
| 探针浮现率 | 85.71% | 100.00% |
| 非探针浮现率 | 93.98% | 98.79% |
| 每回合字数均值 / p95 | 949.88 / 1588 | 1290.52 / 2027 |
| 非携带者字数 | 24217 | 41863 |
| 选入次数 / 不同文字 | 5960 / 111 | 31081 / 383 |
| 最常见5段占比 | 20.34% | 11.42% |
| 单段最多次数 | 292 | 825 |
| 相邻回合重复率 | 26.84% | 15.70% |
| 年龄 <1 / 1–7 / 7–28 / >28 天 | 0 / 1674 / 2784 / 1502 | 1733 / 9510 / 12746 / 7092 |
| 回声次数 / 占比 | 1062 / 17.82% | 1270 / 4.09% |
| 与前景 / 窗口重复 | 0 / 0 | 0 / 0 |
| 有携带者答案 / 全答案 | 37 / 45 | 37 / 45 |
| 候选 / 有携带者 | 100.00% | 86.49% |
| 选中 / 有携带者 | 51.35% | 54.05% |
| 选中 / 已成候选 | 51.35% | 62.50% |
| 未选原因 | {"foreground":6,"no_carrier":8,"ranked_out":12} | {"no_carrier":8,"ranked_out":17} |

### E-SR

| 指标 | life-a | life-b |
| --- | --- | --- |
| 探针浮现率 | 85.71% | 100.00% |
| 非探针浮现率 | 93.98% | 98.79% |
| 每回合字数均值 / p95 | 1253.06 / 1657 | 1807.31 / 2094 |
| 非携带者字数 | 33370 | 53634 |
| 选入次数 / 不同文字 | 5960 / 116 | 31081 / 398 |
| 最常见5段占比 | 6.96% | 1.96% |
| 单段最多次数 | 88 | 138 |
| 相邻回合重复率 | 87.82% | 96.26% |
| 年龄 <1 / 1–7 / 7–28 / >28 天 | 0 / 5458 / 488 / 14 | 29492 / 1183 / 403 / 3 |
| 回声次数 / 占比 | 1697 / 28.47% | 2169 / 6.98% |
| 与前景 / 窗口重复 | 0 / 0 | 0 / 0 |
| 有携带者答案 / 全答案 | 37 / 45 | 37 / 45 |
| 候选 / 有携带者 | 94.59% | 59.46% |
| 选中 / 有携带者 | 24.32% | 18.92% |
| 选中 / 已成候选 | 25.71% | 31.82% |
| 未选原因 | {"foreground":7,"no_carrier":8,"ranked_out":21} | {"no_carrier":8,"ranked_out":30} |

### E-SC

| 指标 | life-a | life-b |
| --- | --- | --- |
| 探针浮现率 | 85.71% | 100.00% |
| 非探针浮现率 | 93.98% | 98.79% |
| 每回合字数均值 / p95 | 950.22 / 1588 | 1290.57 / 2027 |
| 非携带者字数 | 24217 | 41863 |
| 选入次数 / 不同文字 | 5960 / 111 | 31081 / 383 |
| 最常见5段占比 | 20.34% | 11.42% |
| 单段最多次数 | 292 | 825 |
| 相邻回合重复率 | 26.84% | 15.70% |
| 年龄 <1 / 1–7 / 7–28 / >28 天 | 0 / 1674 / 2783 / 1503 | 1733 / 9510 / 12745 / 7093 |
| 回声次数 / 占比 | 1062 / 17.82% | 1270 / 4.09% |
| 与前景 / 窗口重复 | 0 / 0 | 0 / 0 |
| 有携带者答案 / 全答案 | 37 / 45 | 37 / 45 |
| 候选 / 有携带者 | 100.00% | 86.49% |
| 选中 / 有携带者 | 51.35% | 54.05% |
| 选中 / 已成候选 | 51.35% | 62.50% |
| 未选原因 | {"foreground":6,"no_carrier":8,"ranked_out":12} | {"no_carrier":8,"ranked_out":17} |

候选到浮现的排除是单独的选择损失，含已在前景的文字；它与“最终答案未被任何渠道呈现”的遗漏不同，不能把 foreground 排除当成答案消失。

## recall 与请求成本

| 生活 | 调用 | 返回段数均值/p95 | 返回字数均值/p95 | 扫描回退 |
| --- | ---: | --- | --- | --- |
| life-a | 35 | 2.57/9 | 1090.40/3136 | {"no_terms":1} |
| life-b | 35 | 5.17/10 | 2397.49/5526 | {"no_terms":1} |

| 生活/臂 | 每回合请求字数均值/p95 | 相对 P8-A0 增量均值/p95 | 清单字节中位数/最大 |
| --- | --- | --- | --- |
| life-a-E-R-excerpt | 3098.90/3963 | 70.54/57 | 764/766 |
| life-a-E-S-excerpt | 3978.24/5149 | 949.88/1243 | 1153/1378 |
| life-a-E-SR-excerpt | 4281.42/5321 | 1253.06/1415 | 1283/1468 |
| life-a-E-SC-excerpt | 4073.72/5275 | 1045.36/1369 | 1153/1378 |
| life-b-E-R-excerpt | 3064.14/3913 | 18.94/10 | 767/770 |
| life-b-E-S-excerpt | 4335.72/5513 | 1290.52/1610 | 1169/1348 |
| life-b-E-SR-excerpt | 4852.52/5865 | 1807.31/1962 | 1278/1432 |
| life-b-E-SC-excerpt | 4358.00/5531 | 1312.80/1628 | 1169/1348 |

这些是字符与请求的成本代理，不是实际模型 token、缓存或账单。墙钟分别保存在 timing.json，不参与确定性比较。

## 更正版本的实际呈现

| 生活/臂 | 探针 | 各版本被浮现 | 各版本经 recall | 最终是否全呈现 |
| --- | --- | --- | --- | --- |
| life-a-E-R-excerpt | P23 | F11a:false, F11b:false | F11a:true, F11b:true | true |
| life-a-E-R-excerpt | P04 | F1a:false, F1b:false | F1a:true, F1b:true | true |
| life-a-E-R-excerpt | P13 | F5a:false, F5b:false | F5a:true, F5b:true | true |
| life-a-E-R-excerpt | P05 | F1a:false, F1b:false | F1a:true, F1b:true | true |
| life-a-E-R-excerpt | P14 | F5a:false, F5b:false | F5a:true, F5b:true | true |
| life-a-E-R-excerpt | P24 | F11a:false, F11b:false, F11c:false | F11a:true, F11b:true, F11c:true | true |
| life-a-E-S-excerpt | P23 | F11a:false, F11b:false | F11a:false, F11b:false | false |
| life-a-E-S-excerpt | P04 | F1a:false, F1b:false | F1a:false, F1b:false | false |
| life-a-E-S-excerpt | P13 | F5a:true, F5b:false | F5a:false, F5b:false | true |
| life-a-E-S-excerpt | P05 | F1a:false, F1b:false | F1a:false, F1b:false | false |
| life-a-E-S-excerpt | P14 | F5a:false, F5b:true | F5a:false, F5b:false | false |
| life-a-E-S-excerpt | P24 | F11a:false, F11b:true, F11c:false | F11a:false, F11b:false, F11c:false | false |
| life-a-E-SR-excerpt | P23 | F11a:false, F11b:false | F11a:false, F11b:false | false |
| life-a-E-SR-excerpt | P04 | F1a:false, F1b:false | F1a:false, F1b:false | false |
| life-a-E-SR-excerpt | P13 | F5a:true, F5b:false | F5a:false, F5b:false | true |
| life-a-E-SR-excerpt | P05 | F1a:false, F1b:false | F1a:false, F1b:false | false |
| life-a-E-SR-excerpt | P14 | F5a:false, F5b:true | F5a:false, F5b:false | false |
| life-a-E-SR-excerpt | P24 | F11a:false, F11b:false, F11c:false | F11a:false, F11b:false, F11c:false | false |
| life-a-E-SC-excerpt | P23 | F11a:false, F11b:false | F11a:false, F11b:false | true |
| life-a-E-SC-excerpt | P04 | F1a:false, F1b:false | F1a:false, F1b:false | true |
| life-a-E-SC-excerpt | P13 | F5a:true, F5b:false | F5a:false, F5b:false | true |
| life-a-E-SC-excerpt | P05 | F1a:false, F1b:false | F1a:false, F1b:false | true |
| life-a-E-SC-excerpt | P14 | F5a:false, F5b:true | F5a:false, F5b:false | true |
| life-a-E-SC-excerpt | P24 | F11a:false, F11b:true, F11c:false | F11a:false, F11b:false, F11c:false | true |
| life-b-E-R-excerpt | P23 | F11a:false, F11b:false | F11a:true, F11b:false | false |
| life-b-E-R-excerpt | P04 | F1a:false, F1b:false | F1a:false, F1b:false | false |
| life-b-E-R-excerpt | P13 | F5a:false, F5b:false | F5a:true, F5b:true | true |
| life-b-E-R-excerpt | P05 | F1a:false, F1b:false | F1a:false, F1b:false | false |
| life-b-E-R-excerpt | P14 | F5a:false, F5b:false | F5a:true, F5b:true | true |
| life-b-E-R-excerpt | P24 | F11a:false, F11b:false, F11c:false | F11a:false, F11b:false, F11c:false | false |
| life-b-E-S-excerpt | P23 | F11a:false, F11b:true | F11a:false, F11b:false | false |
| life-b-E-S-excerpt | P04 | F1a:false, F1b:false | F1a:false, F1b:false | false |
| life-b-E-S-excerpt | P13 | F5a:true, F5b:true | F5a:false, F5b:false | true |
| life-b-E-S-excerpt | P05 | F1a:false, F1b:false | F1a:false, F1b:false | false |
| life-b-E-S-excerpt | P14 | F5a:true, F5b:false | F5a:false, F5b:false | false |
| life-b-E-S-excerpt | P24 | F11a:false, F11b:true, F11c:false | F11a:false, F11b:false, F11c:false | false |
| life-b-E-SR-excerpt | P23 | F11a:false, F11b:false | F11a:false, F11b:false | false |
| life-b-E-SR-excerpt | P04 | F1a:false, F1b:false | F1a:false, F1b:false | false |
| life-b-E-SR-excerpt | P13 | F5a:false, F5b:true | F5a:false, F5b:false | false |
| life-b-E-SR-excerpt | P05 | F1a:false, F1b:false | F1a:false, F1b:false | false |
| life-b-E-SR-excerpt | P14 | F5a:false, F5b:true | F5a:false, F5b:false | false |
| life-b-E-SR-excerpt | P24 | F11a:false, F11b:false, F11c:false | F11a:false, F11b:false, F11c:false | false |
| life-b-E-SC-excerpt | P23 | F11a:false, F11b:true | F11a:false, F11b:false | true |
| life-b-E-SC-excerpt | P04 | F1a:false, F1b:false | F1a:false, F1b:false | false |
| life-b-E-SC-excerpt | P13 | F5a:true, F5b:true | F5a:false, F5b:false | true |
| life-b-E-SC-excerpt | P05 | F1a:false, F1b:false | F1a:false, F1b:false | false |
| life-b-E-SC-excerpt | P14 | F5a:true, F5b:false | F5a:false, F5b:false | true |
| life-b-E-SC-excerpt | P24 | F11a:false, F11b:true, F11c:false | F11a:false, F11b:false, F11c:false | true |

程序没有替模型采用更正，也没有删除旧版本；完整请求中各版本的顺序另见 JSON 的 presentation_order/chronological。

## 逐探针、渠道、排名、遗漏

表中 E-R 的 rank 是携带者的 recall 排名，其余为原始答案的 check 排名；两者不是同一种量。JSON 保留 P8 的 rank/overlap 口径，新增 recall_rank 单列；浮现候选另从真实线索与历史清单统计。

| 生活/臂 | 探针/答案 | P8 A0/A2 | P9 呈现渠道 | rank | 原因 |
| --- | --- | --- | --- | ---: | --- |
| life-a-E-R-excerpt | P01/F1a | true/true | writing,recall_writing | 1 | 已呈现 |
| life-a-E-R-excerpt | P06/F2 | true/true | writing,recall_writing | 1 | 已呈现 |
| life-a-E-R-excerpt | P12/F5a | true/true | writing,recall_writing | 1 | 已呈现 |
| life-a-E-R-excerpt | P02/F1a | false/true | recall_writing | 1 | 已呈现 |
| life-a-E-R-excerpt | P22/F11a | false/true | recall_writing | 1 | 已呈现 |
| life-a-E-R-excerpt | P09/F3 | false/true | recall_writing | 1 | 已呈现 |
| life-a-E-R-excerpt | P23/F11a | false/true | recall_writing | 3 | 已呈现 |
| life-a-E-R-excerpt | P23/F11b | true/true | writing,recall_writing | 1 | 已呈现 |
| life-a-E-R-excerpt | P03/F1a | false/true | recall_writing | 2 | 已呈现 |
| life-a-E-R-excerpt | P15/F6 | false/true | recall_writing | 1 | 已呈现 |
| life-a-E-R-excerpt | P04/F1a | false/true | recall_writing | 3 | 已呈现 |
| life-a-E-R-excerpt | P04/F1b | true/true | writing,recall_writing | 2 | 已呈现 |
| life-a-E-R-excerpt | P07/F2 | false/true | recall_writing | 2 | 已呈现 |
| life-a-E-R-excerpt | P25/F12 | false/true | recall_writing | 1 | 已呈现 |
| life-a-E-R-excerpt | P13/F5a | false/true | recall_writing | 2 | 已呈现 |
| life-a-E-R-excerpt | P13/F5b | true/true | writing,recall_writing | 1 | 已呈现 |
| life-a-E-R-excerpt | P26/M1 | false/true | recall_writing | 1 | 已呈现 |
| life-a-E-R-excerpt | P16/F7 | false/true | recall_writing | 1 | 已呈现 |
| life-a-E-R-excerpt | P17/F8 | false/true | 无 | 无 | no_carrier |
| life-a-E-R-excerpt | P18/F9 | false/true | recall_writing | 2 | 已呈现 |
| life-a-E-R-excerpt | P19/F9 | false/true | recall_writing | 2 | 已呈现 |
| life-a-E-R-excerpt | P28/M3 | false/true | recall_writing | 1 | 已呈现 |
| life-a-E-R-excerpt | P10/F3 | false/true | recall_writing | 2 | 已呈现 |
| life-a-E-R-excerpt | P20/F10 | false/false | 无 | 无 | not_candidate |
| life-a-E-R-excerpt | P21/F10 | false/true | recall_writing | 1 | 已呈现 |
| life-a-E-R-excerpt | P27/M2a | false/true | recall_writing | 4 | 已呈现 |
| life-a-E-R-excerpt | P27/M2b | false/true | recall_writing | 1 | 已呈现 |
| life-a-E-R-excerpt | P27/M2c | false/true | recall_writing | 3 | 已呈现 |
| life-a-E-R-excerpt | P27/M2d | true/true | writing,recall_writing | 2 | 已呈现 |
| life-a-E-R-excerpt | P11/F4 | false/true | recall_writing | 1 | 已呈现 |
| life-a-E-R-excerpt | P08/F2 | false/true | recall_writing | 1 | 已呈现 |
| life-a-E-R-excerpt | P05/F1a | false/true | recall_writing | 3 | 已呈现 |
| life-a-E-R-excerpt | P05/F1b | false/true | recall_writing | 2 | 已呈现 |
| life-a-E-R-excerpt | P14/F5a | false/true | recall_writing | 3 | 已呈现 |
| life-a-E-R-excerpt | P14/F5b | false/true | recall_writing | 1 | 已呈现 |
| life-a-E-R-excerpt | P24/F11a | false/true | recall_writing | 4 | 已呈现 |
| life-a-E-R-excerpt | P24/F11b | false/true | recall_writing | 1 | 已呈现 |
| life-a-E-R-excerpt | P24/F11c | false/true | recall_writing | 5 | 已呈现 |
| life-a-E-S-excerpt | P01/F1a | true/true | writing | 无 | 已呈现 |
| life-a-E-S-excerpt | P06/F2 | true/true | writing | 无 | 已呈现 |
| life-a-E-S-excerpt | P12/F5a | true/true | writing | 无 | 已呈现 |
| life-a-E-S-excerpt | P02/F1a | false/true | surfaced_writing | 无 | 已呈现 |
| life-a-E-S-excerpt | P22/F11a | false/true | surfaced_writing | 无 | 已呈现 |
| life-a-E-S-excerpt | P09/F3 | false/true | surfaced_writing | 无 | 已呈现 |
| life-a-E-S-excerpt | P23/F11a | false/true | 无 | 无 | ranked_out |
| life-a-E-S-excerpt | P23/F11b | true/true | writing | 无 | 已呈现 |
| life-a-E-S-excerpt | P03/F1a | false/true | surfaced_writing | 无 | 已呈现 |
| life-a-E-S-excerpt | P15/F6 | false/true | surfaced_writing | 无 | 已呈现 |
| life-a-E-S-excerpt | P04/F1a | false/true | 无 | 无 | ranked_out |
| life-a-E-S-excerpt | P04/F1b | true/true | writing | 无 | 已呈现 |
| life-a-E-S-excerpt | P07/F2 | false/true | surfaced_writing | 无 | 已呈现 |
| life-a-E-S-excerpt | P25/F12 | false/true | surfaced_writing | 无 | 已呈现 |
| life-a-E-S-excerpt | P13/F5a | false/true | surfaced_writing | 无 | 已呈现 |
| life-a-E-S-excerpt | P13/F5b | true/true | writing | 无 | 已呈现 |
| life-a-E-S-excerpt | P26/M1 | false/true | surfaced_writing | 无 | 已呈现 |
| life-a-E-S-excerpt | P16/F7 | false/true | surfaced_writing | 无 | 已呈现 |
| life-a-E-S-excerpt | P17/F8 | false/true | 无 | 无 | no_carrier |
| life-a-E-S-excerpt | P18/F9 | false/true | surfaced_writing | 无 | 已呈现 |
| life-a-E-S-excerpt | P19/F9 | false/true | surfaced_writing | 无 | 已呈现 |
| life-a-E-S-excerpt | P28/M3 | false/true | surfaced_writing | 无 | 已呈现 |
| life-a-E-S-excerpt | P10/F3 | false/true | 无 | 无 | ranked_out |
| life-a-E-S-excerpt | P20/F10 | false/false | surfaced_writing | 无 | 已呈现 |
| life-a-E-S-excerpt | P21/F10 | false/true | 无 | 无 | ranked_out |
| life-a-E-S-excerpt | P27/M2a | false/true | 无 | 无 | ranked_out |
| life-a-E-S-excerpt | P27/M2b | false/true | surfaced_writing | 无 | 已呈现 |
| life-a-E-S-excerpt | P27/M2c | false/true | surfaced_writing | 无 | 已呈现 |
| life-a-E-S-excerpt | P27/M2d | true/true | writing | 无 | 已呈现 |
| life-a-E-S-excerpt | P11/F4 | false/true | surfaced_writing | 无 | 已呈现 |
| life-a-E-S-excerpt | P08/F2 | false/true | 无 | 无 | ranked_out |
| life-a-E-S-excerpt | P05/F1a | false/true | 无 | 无 | ranked_out |
| life-a-E-S-excerpt | P05/F1b | false/true | 无 | 无 | ranked_out |
| life-a-E-S-excerpt | P14/F5a | false/true | 无 | 无 | ranked_out |
| life-a-E-S-excerpt | P14/F5b | false/true | surfaced_writing | 无 | 已呈现 |
| life-a-E-S-excerpt | P24/F11a | false/true | 无 | 无 | ranked_out |
| life-a-E-S-excerpt | P24/F11b | false/true | surfaced_writing | 无 | 已呈现 |
| life-a-E-S-excerpt | P24/F11c | false/true | 无 | 无 | ranked_out |
| life-a-E-SR-excerpt | P01/F1a | true/true | writing | 无 | 已呈现 |
| life-a-E-SR-excerpt | P06/F2 | true/true | writing | 无 | 已呈现 |
| life-a-E-SR-excerpt | P12/F5a | true/true | writing | 无 | 已呈现 |
| life-a-E-SR-excerpt | P02/F1a | false/true | 无 | 无 | ranked_out |
| life-a-E-SR-excerpt | P22/F11a | false/true | surfaced_writing | 无 | 已呈现 |
| life-a-E-SR-excerpt | P09/F3 | false/true | 无 | 无 | ranked_out |
| life-a-E-SR-excerpt | P23/F11a | false/true | 无 | 无 | ranked_out |
| life-a-E-SR-excerpt | P23/F11b | true/true | writing | 无 | 已呈现 |
| life-a-E-SR-excerpt | P03/F1a | false/true | 无 | 无 | ranked_out |
| life-a-E-SR-excerpt | P15/F6 | false/true | 无 | 无 | ranked_out |
| life-a-E-SR-excerpt | P04/F1a | false/true | 无 | 无 | ranked_out |
| life-a-E-SR-excerpt | P04/F1b | true/true | writing | 无 | 已呈现 |
| life-a-E-SR-excerpt | P07/F2 | false/true | surfaced_writing | 无 | 已呈现 |
| life-a-E-SR-excerpt | P25/F12 | false/true | 无 | 无 | ranked_out |
| life-a-E-SR-excerpt | P13/F5a | false/true | surfaced_writing | 无 | 已呈现 |
| life-a-E-SR-excerpt | P13/F5b | true/true | writing | 无 | 已呈现 |
| life-a-E-SR-excerpt | P26/M1 | false/true | 无 | 无 | ranked_out |
| life-a-E-SR-excerpt | P16/F7 | false/true | 无 | 无 | ranked_out |
| life-a-E-SR-excerpt | P17/F8 | false/true | 无 | 无 | no_carrier |
| life-a-E-SR-excerpt | P18/F9 | false/true | surfaced_writing | 无 | 已呈现 |
| life-a-E-SR-excerpt | P19/F9 | false/true | surfaced_writing | 无 | 已呈现 |
| life-a-E-SR-excerpt | P28/M3 | false/true | surfaced_writing | 无 | 已呈现 |
| life-a-E-SR-excerpt | P10/F3 | false/true | 无 | 无 | ranked_out |
| life-a-E-SR-excerpt | P20/F10 | false/false | 无 | 无 | ranked_out |
| life-a-E-SR-excerpt | P21/F10 | false/true | 无 | 无 | ranked_out |
| life-a-E-SR-excerpt | P27/M2a | false/true | 无 | 无 | ranked_out |
| life-a-E-SR-excerpt | P27/M2b | false/true | 无 | 无 | ranked_out |
| life-a-E-SR-excerpt | P27/M2c | false/true | surfaced_writing | 无 | 已呈现 |
| life-a-E-SR-excerpt | P27/M2d | true/true | writing | 无 | 已呈现 |
| life-a-E-SR-excerpt | P11/F4 | false/true | surfaced_writing | 无 | 已呈现 |
| life-a-E-SR-excerpt | P08/F2 | false/true | 无 | 无 | ranked_out |
| life-a-E-SR-excerpt | P05/F1a | false/true | 无 | 无 | ranked_out |
| life-a-E-SR-excerpt | P05/F1b | false/true | 无 | 无 | ranked_out |
| life-a-E-SR-excerpt | P14/F5a | false/true | 无 | 无 | ranked_out |
| life-a-E-SR-excerpt | P14/F5b | false/true | surfaced_writing | 无 | 已呈现 |
| life-a-E-SR-excerpt | P24/F11a | false/true | 无 | 无 | ranked_out |
| life-a-E-SR-excerpt | P24/F11b | false/true | 无 | 无 | ranked_out |
| life-a-E-SR-excerpt | P24/F11c | false/true | 无 | 无 | ranked_out |
| life-a-E-SC-excerpt | P01/F1a | true/true | writing,check,check_writing | 2 | 已呈现 |
| life-a-E-SC-excerpt | P06/F2 | true/true | writing,check,check_writing | 2 | 已呈现 |
| life-a-E-SC-excerpt | P12/F5a | true/true | writing,check,check_writing | 2 | 已呈现 |
| life-a-E-SC-excerpt | P02/F1a | false/true | check,check_writing,surfaced_writing | 3 | 已呈现 |
| life-a-E-SC-excerpt | P22/F11a | false/true | check,check_writing,surfaced_writing | 2 | 已呈现 |
| life-a-E-SC-excerpt | P09/F3 | false/true | check,check_writing,surfaced_writing | 2 | 已呈现 |
| life-a-E-SC-excerpt | P23/F11a | false/true | check,check_writing | 3 | 已呈现 |
| life-a-E-SC-excerpt | P23/F11b | true/true | writing,check,check_writing | 4 | 已呈现 |
| life-a-E-SC-excerpt | P03/F1a | false/true | check,check_writing,surfaced_writing | 4 | 已呈现 |
| life-a-E-SC-excerpt | P15/F6 | false/true | check,check_writing,surfaced_writing | 2 | 已呈现 |
| life-a-E-SC-excerpt | P04/F1a | false/true | check,check_writing | 5 | 已呈现 |
| life-a-E-SC-excerpt | P04/F1b | true/true | writing,check,check_writing | 6 | 已呈现 |
| life-a-E-SC-excerpt | P07/F2 | false/true | check,check_writing,surfaced_writing | 3 | 已呈现 |
| life-a-E-SC-excerpt | P25/F12 | false/true | check,check_writing,surfaced_writing | 2 | 已呈现 |
| life-a-E-SC-excerpt | P13/F5a | false/true | check,check_writing,surfaced_writing | 3 | 已呈现 |
| life-a-E-SC-excerpt | P13/F5b | true/true | writing,check,check_writing | 4 | 已呈现 |
| life-a-E-SC-excerpt | P26/M1 | false/true | check,check_writing,surfaced_writing | 2 | 已呈现 |
| life-a-E-SC-excerpt | P16/F7 | false/true | check,check_writing,surfaced_writing | 1 | 已呈现 |
| life-a-E-SC-excerpt | P17/F8 | false/true | check | 2 | 已呈现 |
| life-a-E-SC-excerpt | P18/F9 | false/true | check,check_writing,surfaced_writing | 2 | 已呈现 |
| life-a-E-SC-excerpt | P19/F9 | false/true | check,check_writing,surfaced_writing | 1 | 已呈现 |
| life-a-E-SC-excerpt | P28/M3 | false/true | check,check_writing,surfaced_writing | 2 | 已呈现 |
| life-a-E-SC-excerpt | P10/F3 | false/true | check,check_writing | 3 | 已呈现 |
| life-a-E-SC-excerpt | P20/F10 | false/false | surfaced_writing | 无 | 已呈现 |
| life-a-E-SC-excerpt | P21/F10 | false/true | check,check_writing | 1 | 已呈现 |
| life-a-E-SC-excerpt | P27/M2a | false/true | check,check_writing | 5 | 已呈现 |
| life-a-E-SC-excerpt | P27/M2b | false/true | check,check_writing,surfaced_writing | 1 | 已呈现 |
| life-a-E-SC-excerpt | P27/M2c | false/true | check,check_writing,surfaced_writing | 2 | 已呈现 |
| life-a-E-SC-excerpt | P27/M2d | true/true | writing,check,check_writing | 4 | 已呈现 |
| life-a-E-SC-excerpt | P11/F4 | false/true | check,check_writing,surfaced_writing | 2 | 已呈现 |
| life-a-E-SC-excerpt | P08/F2 | false/true | check,check_writing | 2 | 已呈现 |
| life-a-E-SC-excerpt | P05/F1a | false/true | check,check_writing | 6 | 已呈现 |
| life-a-E-SC-excerpt | P05/F1b | false/true | check,check_writing | 7 | 已呈现 |
| life-a-E-SC-excerpt | P14/F5a | false/true | check,check_writing | 4 | 已呈现 |
| life-a-E-SC-excerpt | P14/F5b | false/true | check,check_writing,surfaced_writing | 5 | 已呈现 |
| life-a-E-SC-excerpt | P24/F11a | false/true | check,check_writing | 4 | 已呈现 |
| life-a-E-SC-excerpt | P24/F11b | false/true | check,check_writing,surfaced_writing | 6 | 已呈现 |
| life-a-E-SC-excerpt | P24/F11c | false/true | check,check_writing | 5 | 已呈现 |
| life-b-E-R-excerpt | P01/F1a | false/true | recall_writing | 1 | 已呈现 |
| life-b-E-R-excerpt | P06/F2 | false/true | recall_writing | 1 | 已呈现 |
| life-b-E-R-excerpt | P12/F5a | false/true | recall_writing | 1 | 已呈现 |
| life-b-E-R-excerpt | P02/F1a | false/true | 无 | 10 | ranked_out |
| life-b-E-R-excerpt | P22/F11a | false/true | recall_writing | 1 | 已呈现 |
| life-b-E-R-excerpt | P09/F3 | false/false | 无 | 26 | ranked_out |
| life-b-E-R-excerpt | P23/F11a | false/true | recall_writing | 7 | 已呈现 |
| life-b-E-R-excerpt | P23/F11b | false/true | 无 | 42 | ranked_out |
| life-b-E-R-excerpt | P03/F1a | false/false | 无 | 20 | ranked_out |
| life-b-E-R-excerpt | P15/F6 | false/true | recall_writing | 1 | 已呈现 |
| life-b-E-R-excerpt | P04/F1a | false/false | 无 | 24 | ranked_out |
| life-b-E-R-excerpt | P04/F1b | false/false | 无 | 61 | ranked_out |
| life-b-E-R-excerpt | P07/F2 | false/true | recall_writing | 1 | 已呈现 |
| life-b-E-R-excerpt | P25/F12 | false/true | recall_writing | 1 | 已呈现 |
| life-b-E-R-excerpt | P13/F5a | false/true | recall_writing | 2 | 已呈现 |
| life-b-E-R-excerpt | P13/F5b | false/true | recall_writing | 3 | 已呈现 |
| life-b-E-R-excerpt | P26/M1 | false/true | recall_writing | 1 | 已呈现 |
| life-b-E-R-excerpt | P16/F7 | false/true | recall_writing | 1 | 已呈现 |
| life-b-E-R-excerpt | P17/F8 | false/false | 无 | 无 | no_carrier |
| life-b-E-R-excerpt | P18/F9 | false/true | 无 | 23 | ranked_out |
| life-b-E-R-excerpt | P19/F9 | false/true | recall_writing | 5 | 已呈现 |
| life-b-E-R-excerpt | P28/M3 | false/true | recall_writing | 2 | 已呈现 |
| life-b-E-R-excerpt | P10/F3 | false/false | 无 | 72 | ranked_out |
| life-b-E-R-excerpt | P20/F10 | false/false | 无 | 无 | not_candidate |
| life-b-E-R-excerpt | P21/F10 | false/true | recall_writing | 1 | 已呈现 |
| life-b-E-R-excerpt | P27/M2a | false/true | recall_writing | 4 | 已呈现 |
| life-b-E-R-excerpt | P27/M2b | false/true | recall_writing | 3 | 已呈现 |
| life-b-E-R-excerpt | P27/M2c | false/true | recall_writing | 1 | 已呈现 |
| life-b-E-R-excerpt | P27/M2d | false/true | recall_writing | 2 | 已呈现 |
| life-b-E-R-excerpt | P11/F4 | false/true | recall_writing | 1 | 已呈现 |
| life-b-E-R-excerpt | P08/F2 | false/true | recall_writing | 1 | 已呈现 |
| life-b-E-R-excerpt | P05/F1a | false/false | 无 | 28 | ranked_out |
| life-b-E-R-excerpt | P05/F1b | false/false | 无 | 无 | ranked_out |
| life-b-E-R-excerpt | P14/F5a | false/true | recall_writing | 3 | 已呈现 |
| life-b-E-R-excerpt | P14/F5b | false/true | recall_writing | 4 | 已呈现 |
| life-b-E-R-excerpt | P24/F11a | false/true | 无 | 11 | ranked_out |
| life-b-E-R-excerpt | P24/F11b | false/false | 无 | 无 | ranked_out |
| life-b-E-R-excerpt | P24/F11c | false/true | 无 | 47 | ranked_out |
| life-b-E-S-excerpt | P01/F1a | false/true | surfaced_writing | 无 | 已呈现 |
| life-b-E-S-excerpt | P06/F2 | false/true | surfaced_writing | 无 | 已呈现 |
| life-b-E-S-excerpt | P12/F5a | false/true | surfaced_writing | 无 | 已呈现 |
| life-b-E-S-excerpt | P02/F1a | false/true | surfaced_writing | 无 | 已呈现 |
| life-b-E-S-excerpt | P22/F11a | false/true | surfaced_writing | 无 | 已呈现 |
| life-b-E-S-excerpt | P09/F3 | false/false | surfaced_writing | 无 | 已呈现 |
| life-b-E-S-excerpt | P23/F11a | false/true | 无 | 无 | ranked_out |
| life-b-E-S-excerpt | P23/F11b | false/true | surfaced_writing | 无 | 已呈现 |
| life-b-E-S-excerpt | P03/F1a | false/false | 无 | 无 | ranked_out |
| life-b-E-S-excerpt | P15/F6 | false/true | surfaced_writing | 无 | 已呈现 |
| life-b-E-S-excerpt | P04/F1a | false/false | 无 | 无 | ranked_out |
| life-b-E-S-excerpt | P04/F1b | false/false | 无 | 无 | ranked_out |
| life-b-E-S-excerpt | P07/F2 | false/true | surfaced_writing | 无 | 已呈现 |
| life-b-E-S-excerpt | P25/F12 | false/true | 无 | 无 | ranked_out |
| life-b-E-S-excerpt | P13/F5a | false/true | surfaced_writing | 无 | 已呈现 |
| life-b-E-S-excerpt | P13/F5b | false/true | surfaced_writing | 无 | 已呈现 |
| life-b-E-S-excerpt | P26/M1 | false/true | surfaced_writing | 无 | 已呈现 |
| life-b-E-S-excerpt | P16/F7 | false/true | surfaced_writing | 无 | 已呈现 |
| life-b-E-S-excerpt | P17/F8 | false/false | 无 | 无 | no_carrier |
| life-b-E-S-excerpt | P18/F9 | false/true | 无 | 无 | ranked_out |
| life-b-E-S-excerpt | P19/F9 | false/true | 无 | 无 | ranked_out |
| life-b-E-S-excerpt | P28/M3 | false/true | surfaced_writing | 无 | 已呈现 |
| life-b-E-S-excerpt | P10/F3 | false/false | 无 | 无 | ranked_out |
| life-b-E-S-excerpt | P20/F10 | false/false | surfaced_writing | 无 | 已呈现 |
| life-b-E-S-excerpt | P21/F10 | false/true | surfaced_writing | 无 | 已呈现 |
| life-b-E-S-excerpt | P27/M2a | false/true | 无 | 无 | ranked_out |
| life-b-E-S-excerpt | P27/M2b | false/true | 无 | 无 | ranked_out |
| life-b-E-S-excerpt | P27/M2c | false/true | surfaced_writing | 无 | 已呈现 |
| life-b-E-S-excerpt | P27/M2d | false/true | 无 | 无 | ranked_out |
| life-b-E-S-excerpt | P11/F4 | false/true | surfaced_writing | 无 | 已呈现 |
| life-b-E-S-excerpt | P08/F2 | false/true | 无 | 无 | ranked_out |
| life-b-E-S-excerpt | P05/F1a | false/false | 无 | 无 | ranked_out |
| life-b-E-S-excerpt | P05/F1b | false/false | 无 | 无 | ranked_out |
| life-b-E-S-excerpt | P14/F5a | false/true | surfaced_writing | 无 | 已呈现 |
| life-b-E-S-excerpt | P14/F5b | false/true | 无 | 无 | ranked_out |
| life-b-E-S-excerpt | P24/F11a | false/true | 无 | 无 | ranked_out |
| life-b-E-S-excerpt | P24/F11b | false/false | surfaced_writing | 无 | 已呈现 |
| life-b-E-S-excerpt | P24/F11c | false/true | 无 | 无 | ranked_out |
| life-b-E-SR-excerpt | P01/F1a | false/true | surfaced_writing | 无 | 已呈现 |
| life-b-E-SR-excerpt | P06/F2 | false/true | surfaced_writing | 无 | 已呈现 |
| life-b-E-SR-excerpt | P12/F5a | false/true | surfaced_writing | 无 | 已呈现 |
| life-b-E-SR-excerpt | P02/F1a | false/true | 无 | 无 | ranked_out |
| life-b-E-SR-excerpt | P22/F11a | false/true | 无 | 无 | ranked_out |
| life-b-E-SR-excerpt | P09/F3 | false/false | 无 | 无 | ranked_out |
| life-b-E-SR-excerpt | P23/F11a | false/true | 无 | 无 | ranked_out |
| life-b-E-SR-excerpt | P23/F11b | false/true | 无 | 无 | ranked_out |
| life-b-E-SR-excerpt | P03/F1a | false/false | 无 | 无 | ranked_out |
| life-b-E-SR-excerpt | P15/F6 | false/true | 无 | 无 | ranked_out |
| life-b-E-SR-excerpt | P04/F1a | false/false | 无 | 无 | ranked_out |
| life-b-E-SR-excerpt | P04/F1b | false/false | 无 | 无 | ranked_out |
| life-b-E-SR-excerpt | P07/F2 | false/true | 无 | 无 | ranked_out |
| life-b-E-SR-excerpt | P25/F12 | false/true | 无 | 无 | ranked_out |
| life-b-E-SR-excerpt | P13/F5a | false/true | 无 | 无 | ranked_out |
| life-b-E-SR-excerpt | P13/F5b | false/true | surfaced_writing | 无 | 已呈现 |
| life-b-E-SR-excerpt | P26/M1 | false/true | 无 | 无 | ranked_out |
| life-b-E-SR-excerpt | P16/F7 | false/true | 无 | 无 | ranked_out |
| life-b-E-SR-excerpt | P17/F8 | false/false | 无 | 无 | no_carrier |
| life-b-E-SR-excerpt | P18/F9 | false/true | 无 | 无 | ranked_out |
| life-b-E-SR-excerpt | P19/F9 | false/true | 无 | 无 | ranked_out |
| life-b-E-SR-excerpt | P28/M3 | false/true | 无 | 无 | ranked_out |
| life-b-E-SR-excerpt | P10/F3 | false/false | 无 | 无 | ranked_out |
| life-b-E-SR-excerpt | P20/F10 | false/false | 无 | 无 | ranked_out |
| life-b-E-SR-excerpt | P21/F10 | false/true | 无 | 无 | ranked_out |
| life-b-E-SR-excerpt | P27/M2a | false/true | 无 | 无 | ranked_out |
| life-b-E-SR-excerpt | P27/M2b | false/true | 无 | 无 | ranked_out |
| life-b-E-SR-excerpt | P27/M2c | false/true | surfaced_writing | 无 | 已呈现 |
| life-b-E-SR-excerpt | P27/M2d | false/true | surfaced_writing | 无 | 已呈现 |
| life-b-E-SR-excerpt | P11/F4 | false/true | 无 | 无 | ranked_out |
| life-b-E-SR-excerpt | P08/F2 | false/true | 无 | 无 | ranked_out |
| life-b-E-SR-excerpt | P05/F1a | false/false | 无 | 无 | ranked_out |
| life-b-E-SR-excerpt | P05/F1b | false/false | 无 | 无 | ranked_out |
| life-b-E-SR-excerpt | P14/F5a | false/true | 无 | 无 | ranked_out |
| life-b-E-SR-excerpt | P14/F5b | false/true | surfaced_writing | 无 | 已呈现 |
| life-b-E-SR-excerpt | P24/F11a | false/true | 无 | 无 | ranked_out |
| life-b-E-SR-excerpt | P24/F11b | false/false | 无 | 无 | ranked_out |
| life-b-E-SR-excerpt | P24/F11c | false/true | 无 | 无 | ranked_out |
| life-b-E-SC-excerpt | P01/F1a | false/true | check,check_writing,surfaced_writing | 12 | 已呈现 |
| life-b-E-SC-excerpt | P06/F2 | false/true | check,check_writing,surfaced_writing | 2 | 已呈现 |
| life-b-E-SC-excerpt | P12/F5a | false/true | check,check_writing,surfaced_writing | 2 | 已呈现 |
| life-b-E-SC-excerpt | P02/F1a | false/true | check,surfaced_writing | 32 | 已呈现 |
| life-b-E-SC-excerpt | P22/F11a | false/true | check,surfaced_writing | 2 | 已呈现 |
| life-b-E-SC-excerpt | P09/F3 | false/false | surfaced_writing | 44 | 已呈现 |
| life-b-E-SC-excerpt | P23/F11a | false/true | check | 3 | 已呈现 |
| life-b-E-SC-excerpt | P23/F11b | false/true | check,surfaced_writing | 8 | 已呈现 |
| life-b-E-SC-excerpt | P03/F1a | false/false | 无 | 71 | ranked_out |
| life-b-E-SC-excerpt | P15/F6 | false/true | check,check_writing,surfaced_writing | 2 | 已呈现 |
| life-b-E-SC-excerpt | P04/F1a | false/false | 无 | 86 | ranked_out |
| life-b-E-SC-excerpt | P04/F1b | false/false | 无 | 无 | ranked_out |
| life-b-E-SC-excerpt | P07/F2 | false/true | check,check_writing,surfaced_writing | 3 | 已呈现 |
| life-b-E-SC-excerpt | P25/F12 | false/true | check,check_writing | 2 | 已呈现 |
| life-b-E-SC-excerpt | P13/F5a | false/true | check,check_writing,surfaced_writing | 3 | 已呈现 |
| life-b-E-SC-excerpt | P13/F5b | false/true | check,check_writing,surfaced_writing | 4 | 已呈现 |
| life-b-E-SC-excerpt | P26/M1 | false/true | check,check_writing,surfaced_writing | 2 | 已呈现 |
| life-b-E-SC-excerpt | P16/F7 | false/true | check,check_writing,surfaced_writing | 1 | 已呈现 |
| life-b-E-SC-excerpt | P17/F8 | false/false | 无 | 89 | no_carrier |
| life-b-E-SC-excerpt | P18/F9 | false/true | check | 7 | 已呈现 |
| life-b-E-SC-excerpt | P19/F9 | false/true | check,check_writing | 1 | 已呈现 |
| life-b-E-SC-excerpt | P28/M3 | false/true | check,surfaced_writing | 2 | 已呈现 |
| life-b-E-SC-excerpt | P10/F3 | false/false | 无 | 无 | ranked_out |
| life-b-E-SC-excerpt | P20/F10 | false/false | surfaced_writing | 无 | 已呈现 |
| life-b-E-SC-excerpt | P21/F10 | false/true | check,check_writing,surfaced_writing | 1 | 已呈现 |
| life-b-E-SC-excerpt | P27/M2a | false/true | check,check_writing | 5 | 已呈现 |
| life-b-E-SC-excerpt | P27/M2b | false/true | check,check_writing | 1 | 已呈现 |
| life-b-E-SC-excerpt | P27/M2c | false/true | check,check_writing,surfaced_writing | 2 | 已呈现 |
| life-b-E-SC-excerpt | P27/M2d | false/true | check,check_writing | 4 | 已呈现 |
| life-b-E-SC-excerpt | P11/F4 | false/true | check,check_writing,surfaced_writing | 2 | 已呈现 |
| life-b-E-SC-excerpt | P08/F2 | false/true | check,check_writing | 2 | 已呈现 |
| life-b-E-SC-excerpt | P05/F1a | false/false | 无 | 无 | ranked_out |
| life-b-E-SC-excerpt | P05/F1b | false/false | 无 | 无 | ranked_out |
| life-b-E-SC-excerpt | P14/F5a | false/true | check,check_writing,surfaced_writing | 4 | 已呈现 |
| life-b-E-SC-excerpt | P14/F5b | false/true | check,check_writing | 5 | 已呈现 |
| life-b-E-SC-excerpt | P24/F11a | false/true | check | 4 | 已呈现 |
| life-b-E-SC-excerpt | P24/F11b | false/false | surfaced_writing | 51 | 已呈现 |
| life-b-E-SC-excerpt | P24/F11c | false/true | check | 13 | 已呈现 |

## 遗漏复现

```sh
npm run eval -- explain .local-data/p9-baseline-uYr1Is/life-a-E-R-excerpt P17
npm run eval -- explain .local-data/p9-baseline-uYr1Is/life-a-E-R-excerpt P20
npm run eval -- explain .local-data/p9-baseline-uYr1Is/life-a-E-S-excerpt P23
npm run eval -- explain .local-data/p9-baseline-uYr1Is/life-a-E-S-excerpt P04
npm run eval -- explain .local-data/p9-baseline-uYr1Is/life-a-E-S-excerpt P17
npm run eval -- explain .local-data/p9-baseline-uYr1Is/life-a-E-S-excerpt P10
npm run eval -- explain .local-data/p9-baseline-uYr1Is/life-a-E-S-excerpt P21
npm run eval -- explain .local-data/p9-baseline-uYr1Is/life-a-E-S-excerpt P27
npm run eval -- explain .local-data/p9-baseline-uYr1Is/life-a-E-S-excerpt P08
npm run eval -- explain .local-data/p9-baseline-uYr1Is/life-a-E-S-excerpt P05
npm run eval -- explain .local-data/p9-baseline-uYr1Is/life-a-E-S-excerpt P14
npm run eval -- explain .local-data/p9-baseline-uYr1Is/life-a-E-S-excerpt P24
npm run eval -- explain .local-data/p9-baseline-uYr1Is/life-a-E-SR-excerpt P02
npm run eval -- explain .local-data/p9-baseline-uYr1Is/life-a-E-SR-excerpt P09
npm run eval -- explain .local-data/p9-baseline-uYr1Is/life-a-E-SR-excerpt P23
npm run eval -- explain .local-data/p9-baseline-uYr1Is/life-a-E-SR-excerpt P03
npm run eval -- explain .local-data/p9-baseline-uYr1Is/life-a-E-SR-excerpt P15
npm run eval -- explain .local-data/p9-baseline-uYr1Is/life-a-E-SR-excerpt P04
npm run eval -- explain .local-data/p9-baseline-uYr1Is/life-a-E-SR-excerpt P25
npm run eval -- explain .local-data/p9-baseline-uYr1Is/life-a-E-SR-excerpt P26
npm run eval -- explain .local-data/p9-baseline-uYr1Is/life-a-E-SR-excerpt P16
npm run eval -- explain .local-data/p9-baseline-uYr1Is/life-a-E-SR-excerpt P17
npm run eval -- explain .local-data/p9-baseline-uYr1Is/life-a-E-SR-excerpt P10
npm run eval -- explain .local-data/p9-baseline-uYr1Is/life-a-E-SR-excerpt P20
npm run eval -- explain .local-data/p9-baseline-uYr1Is/life-a-E-SR-excerpt P21
npm run eval -- explain .local-data/p9-baseline-uYr1Is/life-a-E-SR-excerpt P27
npm run eval -- explain .local-data/p9-baseline-uYr1Is/life-a-E-SR-excerpt P08
npm run eval -- explain .local-data/p9-baseline-uYr1Is/life-a-E-SR-excerpt P05
npm run eval -- explain .local-data/p9-baseline-uYr1Is/life-a-E-SR-excerpt P14
npm run eval -- explain .local-data/p9-baseline-uYr1Is/life-a-E-SR-excerpt P24
npm run eval -- explain .local-data/p9-baseline-uYr1Is/life-b-E-R-excerpt P02
npm run eval -- explain .local-data/p9-baseline-uYr1Is/life-b-E-R-excerpt P09
npm run eval -- explain .local-data/p9-baseline-uYr1Is/life-b-E-R-excerpt P23
npm run eval -- explain .local-data/p9-baseline-uYr1Is/life-b-E-R-excerpt P03
npm run eval -- explain .local-data/p9-baseline-uYr1Is/life-b-E-R-excerpt P04
npm run eval -- explain .local-data/p9-baseline-uYr1Is/life-b-E-R-excerpt P17
npm run eval -- explain .local-data/p9-baseline-uYr1Is/life-b-E-R-excerpt P18
npm run eval -- explain .local-data/p9-baseline-uYr1Is/life-b-E-R-excerpt P10
npm run eval -- explain .local-data/p9-baseline-uYr1Is/life-b-E-R-excerpt P20
npm run eval -- explain .local-data/p9-baseline-uYr1Is/life-b-E-R-excerpt P05
npm run eval -- explain .local-data/p9-baseline-uYr1Is/life-b-E-R-excerpt P24
npm run eval -- explain .local-data/p9-baseline-uYr1Is/life-b-E-S-excerpt P23
npm run eval -- explain .local-data/p9-baseline-uYr1Is/life-b-E-S-excerpt P03
npm run eval -- explain .local-data/p9-baseline-uYr1Is/life-b-E-S-excerpt P04
npm run eval -- explain .local-data/p9-baseline-uYr1Is/life-b-E-S-excerpt P25
npm run eval -- explain .local-data/p9-baseline-uYr1Is/life-b-E-S-excerpt P17
npm run eval -- explain .local-data/p9-baseline-uYr1Is/life-b-E-S-excerpt P18
npm run eval -- explain .local-data/p9-baseline-uYr1Is/life-b-E-S-excerpt P19
npm run eval -- explain .local-data/p9-baseline-uYr1Is/life-b-E-S-excerpt P10
npm run eval -- explain .local-data/p9-baseline-uYr1Is/life-b-E-S-excerpt P27
npm run eval -- explain .local-data/p9-baseline-uYr1Is/life-b-E-S-excerpt P08
npm run eval -- explain .local-data/p9-baseline-uYr1Is/life-b-E-S-excerpt P05
npm run eval -- explain .local-data/p9-baseline-uYr1Is/life-b-E-S-excerpt P14
npm run eval -- explain .local-data/p9-baseline-uYr1Is/life-b-E-S-excerpt P24
npm run eval -- explain .local-data/p9-baseline-uYr1Is/life-b-E-SR-excerpt P02
npm run eval -- explain .local-data/p9-baseline-uYr1Is/life-b-E-SR-excerpt P22
npm run eval -- explain .local-data/p9-baseline-uYr1Is/life-b-E-SR-excerpt P09
npm run eval -- explain .local-data/p9-baseline-uYr1Is/life-b-E-SR-excerpt P23
npm run eval -- explain .local-data/p9-baseline-uYr1Is/life-b-E-SR-excerpt P03
npm run eval -- explain .local-data/p9-baseline-uYr1Is/life-b-E-SR-excerpt P15
npm run eval -- explain .local-data/p9-baseline-uYr1Is/life-b-E-SR-excerpt P04
npm run eval -- explain .local-data/p9-baseline-uYr1Is/life-b-E-SR-excerpt P07
npm run eval -- explain .local-data/p9-baseline-uYr1Is/life-b-E-SR-excerpt P25
npm run eval -- explain .local-data/p9-baseline-uYr1Is/life-b-E-SR-excerpt P13
npm run eval -- explain .local-data/p9-baseline-uYr1Is/life-b-E-SR-excerpt P26
npm run eval -- explain .local-data/p9-baseline-uYr1Is/life-b-E-SR-excerpt P16
npm run eval -- explain .local-data/p9-baseline-uYr1Is/life-b-E-SR-excerpt P17
npm run eval -- explain .local-data/p9-baseline-uYr1Is/life-b-E-SR-excerpt P18
npm run eval -- explain .local-data/p9-baseline-uYr1Is/life-b-E-SR-excerpt P19
npm run eval -- explain .local-data/p9-baseline-uYr1Is/life-b-E-SR-excerpt P28
npm run eval -- explain .local-data/p9-baseline-uYr1Is/life-b-E-SR-excerpt P10
npm run eval -- explain .local-data/p9-baseline-uYr1Is/life-b-E-SR-excerpt P20
npm run eval -- explain .local-data/p9-baseline-uYr1Is/life-b-E-SR-excerpt P21
npm run eval -- explain .local-data/p9-baseline-uYr1Is/life-b-E-SR-excerpt P27
npm run eval -- explain .local-data/p9-baseline-uYr1Is/life-b-E-SR-excerpt P11
npm run eval -- explain .local-data/p9-baseline-uYr1Is/life-b-E-SR-excerpt P08
npm run eval -- explain .local-data/p9-baseline-uYr1Is/life-b-E-SR-excerpt P05
npm run eval -- explain .local-data/p9-baseline-uYr1Is/life-b-E-SR-excerpt P14
npm run eval -- explain .local-data/p9-baseline-uYr1Is/life-b-E-SR-excerpt P24
npm run eval -- explain .local-data/p9-baseline-uYr1Is/life-b-E-SC-excerpt P03
npm run eval -- explain .local-data/p9-baseline-uYr1Is/life-b-E-SC-excerpt P04
npm run eval -- explain .local-data/p9-baseline-uYr1Is/life-b-E-SC-excerpt P17
npm run eval -- explain .local-data/p9-baseline-uYr1Is/life-b-E-SC-excerpt P10
npm run eval -- explain .local-data/p9-baseline-uYr1Is/life-b-E-SC-excerpt P05
```

## 限制与 P9-R

没有真实模型调用或费用授权，P9-R 未执行。life-r 与预算护栏仅由离线假模型验证。后续获授权后检验 H7 的自发工具调用率、H1-r 的答案携带率、H2-r 的回答提及与闯入代理；不得将本报告的检索/呈现结果代替这些真实模型结论。浮现保持默认关闭。全部未解释遗漏为零；原因是机械记录，不是对模型心理的解释。
