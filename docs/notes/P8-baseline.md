# P8 九周合成生活基线

本报告只证明检索与呈现，不证明模型理解、注意或使用。假模型查询由脚本给定，比真实模型理想；excerpt 只是固定摘抄策略。

| 生活/臂/写作 | 呈现答案 | 理论词元相交 | 排进前100 | 未解释遗漏 |
| --- | ---: | ---: | ---: | ---: |
| life-a-A0-excerpt | 7/38 | 36 | 0 | 0 |
| life-a-A1-excerpt | 36/38 | 36 | 36 | 0 |
| life-a-A2-excerpt | 37/38 | 36 | 37 | 0 |
| life-a-A0-none | 0/38 | 36 | 0 | 0 |
| life-a-A2-none | 37/38 | 36 | 37 | 0 |
| life-b-A0-excerpt | 0/38 | 36 | 0 | 0 |
| life-b-A1-excerpt | 23/38 | 36 | 25 | 0 |
| life-b-A2-excerpt | 28/38 | 36 | 33 | 0 |

## Q1：旧信息的检索与呈现

- life-a-A0-excerpt（呈现）：<1d 1/1；1-7d 6/6；7-28d 0/9；>28d 0/22。
- life-a-A1-excerpt（呈现）：<1d 1/1；1-7d 6/6；7-28d 9/9；>28d 20/22。
- life-a-A2-excerpt（呈现）：<1d 1/1；1-7d 6/6；7-28d 9/9；>28d 21/22。
- life-a-A0-none（呈现）：<1d 0/1；1-7d 0/6；7-28d 0/9；>28d 0/22。
- life-a-A2-none（呈现）：<1d 1/1；1-7d 6/6；7-28d 9/9；>28d 21/22。
- life-b-A0-excerpt（呈现）：<1d 0/1；1-7d 0/6；7-28d 0/9；>28d 0/22。
- life-b-A1-excerpt（呈现）：<1d 1/1；1-7d 5/6；7-28d 5/9；>28d 12/22。
- life-b-A2-excerpt（呈现）：<1d 1/1；1-7d 5/6；7-28d 8/9；>28d 14/22。

## Q2：新旧材料的竞争

逐版本的排序位置与是否呈现见下表及 JSON 的 corrections。没有按“当前事实”替换旧记录；排序只由词元统计与时间决定。

## Q3：更正前后能否同时呈现

- life-a-A0-excerpt（呈现）：0/6 个更正探针呈现全部版本。
- life-a-A1-excerpt（呈现）：6/6 个更正探针呈现全部版本。
- life-a-A2-excerpt（呈现）：6/6 个更正探针呈现全部版本。
- life-a-A0-none（呈现）：0/6 个更正探针呈现全部版本。
- life-a-A2-none（呈现）：6/6 个更正探针呈现全部版本。
- life-b-A0-excerpt（呈现）：0/6 个更正探针呈现全部版本。
- life-b-A1-excerpt（呈现）：2/6 个更正探针呈现全部版本。
- life-b-A2-excerpt（呈现）：3/6 个更正探针呈现全部版本。

这里的顺序按完整请求里各版本的首次出现位置判定，位置为“消息位置、工具结果内记录位置、原文内anchor位置”。check内部仍按时间排列；先前文字在工具结果之前时，新版本可能先出现在文字中。这是呈现事实，不说明模型会优先采用哪个版本。

同一事实随探针时间的变化（呈现/排名；排名不可跨scan与index解释为相同量）：
- life-a-A0-excerpt/F1：P01/F1a d2: 呈现, rank=无；P02/F1a d9: 遗漏, rank=无；P03/F1a d31: 遗漏, rank=无；P04/F1a d34: 遗漏, rank=无；P04/F1b d34: 呈现, rank=无；P05/F1a d61: 遗漏, rank=无；P05/F1b d61: 遗漏, rank=无。
- life-a-A0-excerpt/F2：P06/F2 d6: 呈现, rank=无；P07/F2 d36: 遗漏, rank=无；P08/F2 d60: 遗漏, rank=无。
- life-a-A0-excerpt/F3：P09/F3 d17: 遗漏, rank=无；P10/F3 d52: 遗漏, rank=无。
- life-a-A0-excerpt/F5：P12/F5a d9: 呈现, rank=无；P13/F5a d41: 遗漏, rank=无；P13/F5b d41: 呈现, rank=无；P14/F5a d62: 遗漏, rank=无；P14/F5b d62: 遗漏, rank=无。
- life-a-A0-excerpt/F11：P22/F11a d12: 遗漏, rank=无；P23/F11a d31: 遗漏, rank=无；P23/F11b d31: 呈现, rank=无；P24/F11a d63: 遗漏, rank=无；P24/F11b d63: 遗漏, rank=无；P24/F11c d63: 遗漏, rank=无。
- life-a-A1-excerpt/F1：P01/F1a d2: 呈现, rank=3；P02/F1a d9: 呈现, rank=5；P03/F1a d31: 呈现, rank=7；P04/F1a d34: 呈现, rank=11；P04/F1b d34: 呈现, rank=3；P05/F1a d61: 呈现, rank=13；P05/F1b d61: 呈现, rank=5。
- life-a-A1-excerpt/F2：P06/F2 d6: 呈现, rank=3；P07/F2 d36: 呈现, rank=5；P08/F2 d60: 呈现, rank=3。
- life-a-A1-excerpt/F3：P09/F3 d17: 呈现, rank=3；P10/F3 d52: 呈现, rank=5。
- life-a-A1-excerpt/F5：P12/F5a d9: 呈现, rank=3；P13/F5a d41: 呈现, rank=7；P13/F5b d41: 呈现, rank=3；P14/F5a d62: 呈现, rank=9；P14/F5b d62: 呈现, rank=5。
- life-a-A1-excerpt/F11：P22/F11a d12: 呈现, rank=3；P23/F11a d31: 呈现, rank=7；P23/F11b d31: 呈现, rank=3；P24/F11a d63: 呈现, rank=11；P24/F11b d63: 呈现, rank=7；P24/F11c d63: 呈现, rank=3。
- life-a-A2-excerpt/F1：P01/F1a d2: 呈现, rank=2；P02/F1a d9: 呈现, rank=3；P03/F1a d31: 呈现, rank=4；P04/F1a d34: 呈现, rank=5；P04/F1b d34: 呈现, rank=6；P05/F1a d61: 呈现, rank=6；P05/F1b d61: 呈现, rank=7。
- life-a-A2-excerpt/F2：P06/F2 d6: 呈现, rank=2；P07/F2 d36: 呈现, rank=3；P08/F2 d60: 呈现, rank=2。
- life-a-A2-excerpt/F3：P09/F3 d17: 呈现, rank=2；P10/F3 d52: 呈现, rank=3。
- life-a-A2-excerpt/F5：P12/F5a d9: 呈现, rank=2；P13/F5a d41: 呈现, rank=3；P13/F5b d41: 呈现, rank=4；P14/F5a d62: 呈现, rank=4；P14/F5b d62: 呈现, rank=5。
- life-a-A2-excerpt/F11：P22/F11a d12: 呈现, rank=2；P23/F11a d31: 呈现, rank=3；P23/F11b d31: 呈现, rank=4；P24/F11a d63: 呈现, rank=4；P24/F11b d63: 呈现, rank=6；P24/F11c d63: 呈现, rank=5。
- life-a-A0-none/F1：P01/F1a d2: 遗漏, rank=无；P02/F1a d9: 遗漏, rank=无；P03/F1a d31: 遗漏, rank=无；P04/F1a d34: 遗漏, rank=无；P04/F1b d34: 遗漏, rank=无；P05/F1a d61: 遗漏, rank=无；P05/F1b d61: 遗漏, rank=无。
- life-a-A0-none/F2：P06/F2 d6: 遗漏, rank=无；P07/F2 d36: 遗漏, rank=无；P08/F2 d60: 遗漏, rank=无。
- life-a-A0-none/F3：P09/F3 d17: 遗漏, rank=无；P10/F3 d52: 遗漏, rank=无。
- life-a-A0-none/F5：P12/F5a d9: 遗漏, rank=无；P13/F5a d41: 遗漏, rank=无；P13/F5b d41: 遗漏, rank=无；P14/F5a d62: 遗漏, rank=无；P14/F5b d62: 遗漏, rank=无。
- life-a-A0-none/F11：P22/F11a d12: 遗漏, rank=无；P23/F11a d31: 遗漏, rank=无；P23/F11b d31: 遗漏, rank=无；P24/F11a d63: 遗漏, rank=无；P24/F11b d63: 遗漏, rank=无；P24/F11c d63: 遗漏, rank=无。
- life-a-A2-none/F1：P01/F1a d2: 呈现, rank=2；P02/F1a d9: 呈现, rank=3；P03/F1a d31: 呈现, rank=4；P04/F1a d34: 呈现, rank=5；P04/F1b d34: 呈现, rank=6；P05/F1a d61: 呈现, rank=6；P05/F1b d61: 呈现, rank=7。
- life-a-A2-none/F2：P06/F2 d6: 呈现, rank=2；P07/F2 d36: 呈现, rank=3；P08/F2 d60: 呈现, rank=2。
- life-a-A2-none/F3：P09/F3 d17: 呈现, rank=2；P10/F3 d52: 呈现, rank=3。
- life-a-A2-none/F5：P12/F5a d9: 呈现, rank=2；P13/F5a d41: 呈现, rank=3；P13/F5b d41: 呈现, rank=4；P14/F5a d62: 呈现, rank=4；P14/F5b d62: 呈现, rank=5。
- life-a-A2-none/F11：P22/F11a d12: 呈现, rank=2；P23/F11a d31: 呈现, rank=3；P23/F11b d31: 呈现, rank=4；P24/F11a d63: 呈现, rank=4；P24/F11b d63: 呈现, rank=6；P24/F11c d63: 呈现, rank=5。
- life-b-A0-excerpt/F1：P01/F1a d2: 遗漏, rank=无；P02/F1a d9: 遗漏, rank=无；P03/F1a d31: 遗漏, rank=无；P04/F1a d34: 遗漏, rank=无；P04/F1b d34: 遗漏, rank=无；P05/F1a d61: 遗漏, rank=无；P05/F1b d61: 遗漏, rank=无。
- life-b-A0-excerpt/F2：P06/F2 d6: 遗漏, rank=无；P07/F2 d36: 遗漏, rank=无；P08/F2 d60: 遗漏, rank=无。
- life-b-A0-excerpt/F3：P09/F3 d17: 遗漏, rank=无；P10/F3 d52: 遗漏, rank=无。
- life-b-A0-excerpt/F5：P12/F5a d9: 遗漏, rank=无；P13/F5a d41: 遗漏, rank=无；P13/F5b d41: 遗漏, rank=无；P14/F5a d62: 遗漏, rank=无；P14/F5b d62: 遗漏, rank=无。
- life-b-A0-excerpt/F11：P22/F11a d12: 遗漏, rank=无；P23/F11a d31: 遗漏, rank=无；P23/F11b d31: 遗漏, rank=无；P24/F11a d63: 遗漏, rank=无；P24/F11b d63: 遗漏, rank=无；P24/F11c d63: 遗漏, rank=无。
- life-b-A1-excerpt/F1：P01/F1a d2: 呈现, rank=21；P02/F1a d9: 遗漏, rank=无；P03/F1a d31: 遗漏, rank=无；P04/F1a d34: 遗漏, rank=无；P04/F1b d34: 呈现, rank=38；P05/F1a d61: 遗漏, rank=无；P05/F1b d61: 遗漏, rank=无。
- life-b-A1-excerpt/F2：P06/F2 d6: 呈现, rank=3；P07/F2 d36: 呈现, rank=5；P08/F2 d60: 呈现, rank=3。
- life-b-A1-excerpt/F3：P09/F3 d17: 遗漏, rank=无；P10/F3 d52: 遗漏, rank=无。
- life-b-A1-excerpt/F5：P12/F5a d9: 呈现, rank=3；P13/F5a d41: 呈现, rank=7；P13/F5b d41: 呈现, rank=3；P14/F5a d62: 呈现, rank=9；P14/F5b d62: 呈现, rank=5。
- life-b-A1-excerpt/F11：P22/F11a d12: 呈现, rank=3；P23/F11a d31: 遗漏, rank=无；P23/F11b d31: 遗漏, rank=62；P24/F11a d63: 遗漏, rank=无；P24/F11b d63: 遗漏, rank=无；P24/F11c d63: 遗漏, rank=无。
- life-b-A2-excerpt/F1：P01/F1a d2: 呈现, rank=12；P02/F1a d9: 呈现, rank=32；P03/F1a d31: 遗漏, rank=71；P04/F1a d34: 遗漏, rank=86；P04/F1b d34: 遗漏, rank=无；P05/F1a d61: 遗漏, rank=无；P05/F1b d61: 遗漏, rank=无。
- life-b-A2-excerpt/F2：P06/F2 d6: 呈现, rank=2；P07/F2 d36: 呈现, rank=3；P08/F2 d60: 呈现, rank=2。
- life-b-A2-excerpt/F3：P09/F3 d17: 遗漏, rank=44；P10/F3 d52: 遗漏, rank=无。
- life-b-A2-excerpt/F5：P12/F5a d9: 呈现, rank=2；P13/F5a d41: 呈现, rank=3；P13/F5b d41: 呈现, rank=4；P14/F5a d62: 呈现, rank=4；P14/F5b d62: 呈现, rank=5。
- life-b-A2-excerpt/F11：P22/F11a d12: 呈现, rank=2；P23/F11a d31: 呈现, rank=3；P23/F11b d31: 呈现, rank=8；P24/F11a d63: 呈现, rank=4；P24/F11b d63: 遗漏, rank=51；P24/F11c d63: 呈现, rank=13。

## Q4：高频日常的干扰

相同事实、时间与探针在两段生活中保持不变；下表按臂比较，不把差异解释成语义能力。
- A0（呈现）：高频标签答案 life-a 1/10；life-b 0/10。
- A1（呈现）：高频标签答案 life-a 9/10；life-b 1/10。
- A2（呈现）：高频标签答案 life-a 10/10；life-b 6/10。

## Q5：候选、前100与实际呈现的损失

理论词元相交不等于实际查询到：A0没有查询；emoji等scan回退可能没有可用词元而仍被返回。检索与所有渠道呈现也不是严格的漏斗：文字与窗口可能直接呈现；强制最近条可能排在前100之外。

| 生活/臂 | 全部词相交 | 保留词相交 | 排进前100 | check呈现但不在前100 | 无check主答案仍呈现 | 全渠道呈现 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| life-a-A0-excerpt | 36/38 | 0 | 0 | 0 | 7 | 7 |
| life-a-A1-excerpt | 36/38 | 0 | 36 | 0 | 0 | 36 |
| life-a-A2-excerpt | 36/38 | 36 | 37 | 0 | 0 | 37 |
| life-a-A0-none | 36/38 | 0 | 0 | 0 | 0 | 0 |
| life-a-A2-none | 36/38 | 36 | 37 | 0 | 0 | 37 |
| life-b-A0-excerpt | 36/38 | 0 | 0 | 0 | 0 | 0 |
| life-b-A1-excerpt | 36/38 | 0 | 25 | 0 | 0 | 23 |
| life-b-A2-excerpt | 36/38 | 36 | 33 | 0 | 0 | 28 |

## A2 相对 A1 的逐探针对照

下表只比较检索/呈现事实。rank=无表示不在所记录前100，不能当成没有候选；旧版scan按时间排序。

| 生活 | 探针/答案 | A1 呈现 / rank / 原因 | A2 呈现 / rank / 原因 |
| --- | --- | --- | --- |
| life-a | P01/F1a | 是 / 3 / 已呈现 | 是 / 2 / 已呈现 |
| life-a | P06/F2 | 是 / 3 / 已呈现 | 是 / 2 / 已呈现 |
| life-a | P12/F5a | 是 / 3 / 已呈现 | 是 / 2 / 已呈现 |
| life-a | P02/F1a | 是 / 5 / 已呈现 | 是 / 3 / 已呈现 |
| life-a | P22/F11a | 是 / 3 / 已呈现 | 是 / 2 / 已呈现 |
| life-a | P09/F3 | 是 / 3 / 已呈现 | 是 / 2 / 已呈现 |
| life-a | P23/F11a | 是 / 7 / 已呈现 | 是 / 3 / 已呈现 |
| life-a | P23/F11b | 是 / 3 / 已呈现 | 是 / 4 / 已呈现 |
| life-a | P03/F1a | 是 / 7 / 已呈现 | 是 / 4 / 已呈现 |
| life-a | P15/F6 | 是 / 3 / 已呈现 | 是 / 2 / 已呈现 |
| life-a | P04/F1a | 是 / 11 / 已呈现 | 是 / 5 / 已呈现 |
| life-a | P04/F1b | 是 / 3 / 已呈现 | 是 / 6 / 已呈现 |
| life-a | P07/F2 | 是 / 5 / 已呈现 | 是 / 3 / 已呈现 |
| life-a | P25/F12 | 是 / 2 / 已呈现 | 是 / 2 / 已呈现 |
| life-a | P13/F5a | 是 / 7 / 已呈现 | 是 / 3 / 已呈现 |
| life-a | P13/F5b | 是 / 3 / 已呈现 | 是 / 4 / 已呈现 |
| life-a | P26/M1 | 是 / 3 / 已呈现 | 是 / 2 / 已呈现 |
| life-a | P16/F7 | 是 / 2 / 已呈现 | 是 / 1 / 已呈现 |
| life-a | P17/F8 | 是 / 2 / 已呈现 | 是 / 2 / 已呈现 |
| life-a | P18/F9 | 是 / 5 / 已呈现 | 是 / 2 / 已呈现 |
| life-a | P19/F9 | 是 / 4 / 已呈现 | 是 / 1 / 已呈现 |
| life-a | P28/M3 | 否 / 无 / substring_miss | 是 / 2 / 已呈现 |
| life-a | P10/F3 | 是 / 5 / 已呈现 | 是 / 3 / 已呈现 |
| life-a | P20/F10 | 否 / 无 / substring_miss | 否 / 无 / no_overlap |
| life-a | P21/F10 | 是 / 2 / 已呈现 | 是 / 1 / 已呈现 |
| life-a | P27/M2a | 是 / 9 / 已呈现 | 是 / 5 / 已呈现 |
| life-a | P27/M2b | 是 / 7 / 已呈现 | 是 / 1 / 已呈现 |
| life-a | P27/M2c | 是 / 5 / 已呈现 | 是 / 2 / 已呈现 |
| life-a | P27/M2d | 是 / 3 / 已呈现 | 是 / 4 / 已呈现 |
| life-a | P11/F4 | 是 / 3 / 已呈现 | 是 / 2 / 已呈现 |
| life-a | P08/F2 | 是 / 3 / 已呈现 | 是 / 2 / 已呈现 |
| life-a | P05/F1a | 是 / 13 / 已呈现 | 是 / 6 / 已呈现 |
| life-a | P05/F1b | 是 / 5 / 已呈现 | 是 / 7 / 已呈现 |
| life-a | P14/F5a | 是 / 9 / 已呈现 | 是 / 4 / 已呈现 |
| life-a | P14/F5b | 是 / 5 / 已呈现 | 是 / 5 / 已呈现 |
| life-a | P24/F11a | 是 / 11 / 已呈现 | 是 / 4 / 已呈现 |
| life-a | P24/F11b | 是 / 7 / 已呈现 | 是 / 6 / 已呈现 |
| life-a | P24/F11c | 是 / 3 / 已呈现 | 是 / 5 / 已呈现 |
| life-b | P01/F1a | 是 / 21 / 已呈现 | 是 / 12 / 已呈现 |
| life-b | P06/F2 | 是 / 3 / 已呈现 | 是 / 2 / 已呈现 |
| life-b | P12/F5a | 是 / 3 / 已呈现 | 是 / 2 / 已呈现 |
| life-b | P02/F1a | 否 / 无 / recency_cut | 是 / 32 / 已呈现 |
| life-b | P22/F11a | 是 / 3 / 已呈现 | 是 / 2 / 已呈现 |
| life-b | P09/F3 | 否 / 无 / recency_cut | 否 / 44 / ranked_out |
| life-b | P23/F11a | 否 / 无 / recency_cut | 是 / 3 / 已呈现 |
| life-b | P23/F11b | 否 / 62 / recency_cut | 是 / 8 / 已呈现 |
| life-b | P03/F1a | 否 / 无 / recency_cut | 否 / 71 / ranked_out |
| life-b | P15/F6 | 是 / 3 / 已呈现 | 是 / 2 / 已呈现 |
| life-b | P04/F1a | 否 / 无 / recency_cut | 否 / 86 / ranked_out |
| life-b | P04/F1b | 是 / 38 / 已呈现 | 否 / 无 / ranked_out |
| life-b | P07/F2 | 是 / 5 / 已呈现 | 是 / 3 / 已呈现 |
| life-b | P25/F12 | 是 / 2 / 已呈现 | 是 / 2 / 已呈现 |
| life-b | P13/F5a | 是 / 7 / 已呈现 | 是 / 3 / 已呈现 |
| life-b | P13/F5b | 是 / 3 / 已呈现 | 是 / 4 / 已呈现 |
| life-b | P26/M1 | 是 / 3 / 已呈现 | 是 / 2 / 已呈现 |
| life-b | P16/F7 | 是 / 2 / 已呈现 | 是 / 1 / 已呈现 |
| life-b | P17/F8 | 是 / 29 / 已呈现 | 否 / 89 / ranked_out |
| life-b | P18/F9 | 否 / 55 / recency_cut | 是 / 7 / 已呈现 |
| life-b | P19/F9 | 是 / 2 / 已呈现 | 是 / 1 / 已呈现 |
| life-b | P28/M3 | 否 / 无 / substring_miss | 是 / 2 / 已呈现 |
| life-b | P10/F3 | 否 / 无 / recency_cut | 否 / 无 / ranked_out |
| life-b | P20/F10 | 否 / 无 / substring_miss | 否 / 无 / no_overlap |
| life-b | P21/F10 | 是 / 2 / 已呈现 | 是 / 1 / 已呈现 |
| life-b | P27/M2a | 是 / 9 / 已呈现 | 是 / 5 / 已呈现 |
| life-b | P27/M2b | 是 / 7 / 已呈现 | 是 / 1 / 已呈现 |
| life-b | P27/M2c | 是 / 5 / 已呈现 | 是 / 2 / 已呈现 |
| life-b | P27/M2d | 是 / 3 / 已呈现 | 是 / 4 / 已呈现 |
| life-b | P11/F4 | 是 / 3 / 已呈现 | 是 / 2 / 已呈现 |
| life-b | P08/F2 | 是 / 3 / 已呈现 | 是 / 2 / 已呈现 |
| life-b | P05/F1a | 否 / 无 / recency_cut | 否 / 无 / ranked_out |
| life-b | P05/F1b | 否 / 无 / recency_cut | 否 / 无 / ranked_out |
| life-b | P14/F5a | 是 / 9 / 已呈现 | 是 / 4 / 已呈现 |
| life-b | P14/F5b | 是 / 5 / 已呈现 | 是 / 5 / 已呈现 |
| life-b | P24/F11a | 否 / 无 / recency_cut | 是 / 4 / 已呈现 |
| life-b | P24/F11b | 否 / 无 / recency_cut | 否 / 51 / ranked_out |
| life-b | P24/F11c | 否 / 无 / recency_cut | 是 / 13 / 已呈现 |

对照变化的机械原因：A1 是区分大小写的整段子串与时间截取，A2 是 NFKC/小写词元并集与 bm25 排序；因此两者的 rank 不是同一种量。下列变化只描述选取与呈现，不是模型理解的改变。
- life-a P28/M3：substring_miss → 呈现；A1 rank=无，A2 rank=2。
- life-b P02/F1a：recency_cut → 呈现；A1 rank=无，A2 rank=32。
- life-b P23/F11a：recency_cut → 呈现；A1 rank=无，A2 rank=3。
- life-b P23/F11b：recency_cut → 呈现；A1 rank=62，A2 rank=8。
- life-b P04/F1b：呈现 → ranked_out；A1 rank=38，A2 rank=无。
- life-b P17/F8：呈现 → ranked_out；A1 rank=29，A2 rank=89。
- life-b P18/F9：recency_cut → 呈现；A1 rank=55，A2 rank=7。
- life-b P28/M3：substring_miss → 呈现；A1 rank=无，A2 rank=2。
- life-b P24/F11a：recency_cut → 呈现；A1 rank=无，A2 rank=4。
- life-b P24/F11c：recency_cut → 呈现；A1 rank=无，A2 rank=13。

## 整理、文字呈现与成本

| 生活/臂 | 空闲/压力整理 | 非空文字 | 从未呈现 | 经check呈现 | 请求数 | 第0步字数均值/p95 | 续步字数均值/p95 | 工具结果字数 |
| --- | ---: | ---: | ---: | ---: | ---: | --- | --- | ---: |
| life-a-A0-excerpt | 52/70 | 122 | 1 | 0 | 2265 | 3028.36024265049/3906 | null/null | 0 |
| life-a-A1-excerpt | 52/70 | 122 | 1 | 31 | 2300 | 3028.6140923938406/3907 | 4362.2/6458 | 45091 |
| life-a-A2-excerpt | 52/70 | 122 | 1 | 40 | 2300 | 3028.6140923938406/3907 | 4775.4857142857145/8709 | 59556 |
| life-a-A0-none | 52/70 | 0 | 0 | 0 | 2265 | 1055.6126924871676/1875 | null/null | 0 |
| life-a-A2-none | 52/70 | 0 | 0 | 0 | 2300 | 1055.866542230518/1875 | 1511.7142857142858/3369 | 15181 |
| life-b-A0-excerpt | 52/350 | 402 | 1 | 0 | 10925 | 3045.203269029744/3903 | null/null | 0 |
| life-b-A1-excerpt | 52/350 | 402 | 1 | 137 | 10960 | 3045.265988786468/3903 | 7075.4857142857145/14915 | 141565 |
| life-b-A2-excerpt | 52/350 | 402 | 1 | 32 | 10960 | 3045.265988786468/3903 | 5008.457142857143/7919 | 69219 |

更正探针的呈现顺序（true为所有版本均呈现且按原事件时间顺序；null为不能作此判断）：
- life-a-A0-excerpt：P23 null (F11b)；P04 null (F1b)；P13 null (F5b)；P05 null (无)；P14 null (无)；P24 null (无)。
- life-a-A1-excerpt：P23 false (F11b → F11a)；P04 false (F1b → F1a)；P13 false (F5b → F5a)；P05 true (F1a → F1b)；P14 true (F5a → F5b)；P24 true (F11a → F11b → F11c)。
- life-a-A2-excerpt：P23 false (F11b → F11a)；P04 false (F1b → F1a)；P13 false (F5b → F5a)；P05 true (F1a → F1b)；P14 true (F5a → F5b)；P24 true (F11a → F11b → F11c)。
- life-a-A0-none：P23 null (无)；P04 null (无)；P13 null (无)；P05 null (无)；P14 null (无)；P24 null (无)。
- life-a-A2-none：P23 true (F11a → F11b)；P04 true (F1a → F1b)；P13 true (F5a → F5b)；P05 true (F1a → F1b)；P14 true (F5a → F5b)；P24 true (F11a → F11b → F11c)。
- life-b-A0-excerpt：P23 null (无)；P04 null (无)；P13 null (无)；P05 null (无)；P14 null (无)；P24 null (无)。
- life-b-A1-excerpt：P23 null (无)；P04 null (F1b)；P13 true (F5a → F5b)；P05 null (无)；P14 true (F5a → F5b)；P24 null (无)。
- life-b-A2-excerpt：P23 true (F11a → F11b)；P04 null (无)；P13 true (F5a → F5b)；P05 null (无)；P14 true (F5a → F5b)；P24 null (F11a → F11c)。

## Q6：遗漏复现

- life-a-A0-excerpt：{"no_check":31,"unexplained":0}。
- life-a-A1-excerpt：{"substring_miss":2,"unexplained":0}。
- life-a-A2-excerpt：{"no_overlap":1,"unexplained":0}。
- life-a-A0-none：{"no_check":38,"unexplained":0}。
- life-a-A2-none：{"no_overlap":1,"unexplained":0}。
- life-b-A0-excerpt：{"no_check":38,"unexplained":0}。
- life-b-A1-excerpt：{"recency_cut":13,"substring_miss":2,"unexplained":0}。
- life-b-A2-excerpt：{"ranked_out":9,"no_overlap":1,"unexplained":0}。

## 逐探针证据与遗漏命令

| 生活/臂 | 探针 | 答案 | 渠道 | 排名 | 原因 |
| --- | --- | --- | --- | ---: | --- |
| life-a-A0-excerpt | P01 | F1a | writing | 不在前100 | 已呈现 |
| life-a-A0-excerpt | P06 | F2 | writing | 不在前100 | 已呈现 |
| life-a-A0-excerpt | P12 | F5a | writing | 不在前100 | 已呈现 |
| life-a-A0-excerpt | P02 | F1a | 无 | 不在前100 | no_check |
| life-a-A0-excerpt | P22 | F11a | 无 | 不在前100 | no_check |
| life-a-A0-excerpt | P09 | F3 | 无 | 不在前100 | no_check |
| life-a-A0-excerpt | P23 | F11a | 无 | 不在前100 | no_check |
| life-a-A0-excerpt | P23 | F11b | writing | 不在前100 | 已呈现 |
| life-a-A0-excerpt | P03 | F1a | 无 | 不在前100 | no_check |
| life-a-A0-excerpt | P15 | F6 | 无 | 不在前100 | no_check |
| life-a-A0-excerpt | P04 | F1a | 无 | 不在前100 | no_check |
| life-a-A0-excerpt | P04 | F1b | writing | 不在前100 | 已呈现 |
| life-a-A0-excerpt | P07 | F2 | 无 | 不在前100 | no_check |
| life-a-A0-excerpt | P25 | F12 | 无 | 不在前100 | no_check |
| life-a-A0-excerpt | P13 | F5a | 无 | 不在前100 | no_check |
| life-a-A0-excerpt | P13 | F5b | writing | 不在前100 | 已呈现 |
| life-a-A0-excerpt | P26 | M1 | 无 | 不在前100 | no_check |
| life-a-A0-excerpt | P16 | F7 | 无 | 不在前100 | no_check |
| life-a-A0-excerpt | P17 | F8 | 无 | 不在前100 | no_check |
| life-a-A0-excerpt | P18 | F9 | 无 | 不在前100 | no_check |
| life-a-A0-excerpt | P19 | F9 | 无 | 不在前100 | no_check |
| life-a-A0-excerpt | P28 | M3 | 无 | 不在前100 | no_check |
| life-a-A0-excerpt | P10 | F3 | 无 | 不在前100 | no_check |
| life-a-A0-excerpt | P20 | F10 | 无 | 不在前100 | no_check |
| life-a-A0-excerpt | P21 | F10 | 无 | 不在前100 | no_check |
| life-a-A0-excerpt | P27 | M2a | 无 | 不在前100 | no_check |
| life-a-A0-excerpt | P27 | M2b | 无 | 不在前100 | no_check |
| life-a-A0-excerpt | P27 | M2c | 无 | 不在前100 | no_check |
| life-a-A0-excerpt | P27 | M2d | writing | 不在前100 | 已呈现 |
| life-a-A0-excerpt | P11 | F4 | 无 | 不在前100 | no_check |
| life-a-A0-excerpt | P08 | F2 | 无 | 不在前100 | no_check |
| life-a-A0-excerpt | P05 | F1a | 无 | 不在前100 | no_check |
| life-a-A0-excerpt | P05 | F1b | 无 | 不在前100 | no_check |
| life-a-A0-excerpt | P14 | F5a | 无 | 不在前100 | no_check |
| life-a-A0-excerpt | P14 | F5b | 无 | 不在前100 | no_check |
| life-a-A0-excerpt | P24 | F11a | 无 | 不在前100 | no_check |
| life-a-A0-excerpt | P24 | F11b | 无 | 不在前100 | no_check |
| life-a-A0-excerpt | P24 | F11c | 无 | 不在前100 | no_check |
| life-a-A1-excerpt | P01 | F1a | writing,check,check_writing | 3 | 已呈现 |
| life-a-A1-excerpt | P06 | F2 | writing,check,check_writing | 3 | 已呈现 |
| life-a-A1-excerpt | P12 | F5a | writing,check,check_writing | 3 | 已呈现 |
| life-a-A1-excerpt | P02 | F1a | check,check_writing | 5 | 已呈现 |
| life-a-A1-excerpt | P22 | F11a | check,check_writing | 3 | 已呈现 |
| life-a-A1-excerpt | P09 | F3 | check,check_writing | 3 | 已呈现 |
| life-a-A1-excerpt | P23 | F11a | check,check_writing | 7 | 已呈现 |
| life-a-A1-excerpt | P23 | F11b | writing,check,check_writing | 3 | 已呈现 |
| life-a-A1-excerpt | P03 | F1a | check,check_writing | 7 | 已呈现 |
| life-a-A1-excerpt | P15 | F6 | check,check_writing | 3 | 已呈现 |
| life-a-A1-excerpt | P04 | F1a | check,check_writing | 11 | 已呈现 |
| life-a-A1-excerpt | P04 | F1b | writing,check,check_writing | 3 | 已呈现 |
| life-a-A1-excerpt | P07 | F2 | check,check_writing | 5 | 已呈现 |
| life-a-A1-excerpt | P25 | F12 | check,check_writing | 2 | 已呈现 |
| life-a-A1-excerpt | P13 | F5a | check,check_writing | 7 | 已呈现 |
| life-a-A1-excerpt | P13 | F5b | writing,check,check_writing | 3 | 已呈现 |
| life-a-A1-excerpt | P26 | M1 | check,check_writing | 3 | 已呈现 |
| life-a-A1-excerpt | P16 | F7 | check,check_writing | 2 | 已呈现 |
| life-a-A1-excerpt | P17 | F8 | check | 2 | 已呈现 |
| life-a-A1-excerpt | P18 | F9 | check,check_writing | 5 | 已呈现 |
| life-a-A1-excerpt | P19 | F9 | check,check_writing | 4 | 已呈现 |
| life-a-A1-excerpt | P28 | M3 | 无 | 不在前100 | substring_miss |
| life-a-A1-excerpt | P10 | F3 | check,check_writing | 5 | 已呈现 |
| life-a-A1-excerpt | P20 | F10 | 无 | 不在前100 | substring_miss |
| life-a-A1-excerpt | P21 | F10 | check,check_writing | 2 | 已呈现 |
| life-a-A1-excerpt | P27 | M2a | check,check_writing | 9 | 已呈现 |
| life-a-A1-excerpt | P27 | M2b | check,check_writing | 7 | 已呈现 |
| life-a-A1-excerpt | P27 | M2c | check,check_writing | 5 | 已呈现 |
| life-a-A1-excerpt | P27 | M2d | writing,check,check_writing | 3 | 已呈现 |
| life-a-A1-excerpt | P11 | F4 | check,check_writing | 3 | 已呈现 |
| life-a-A1-excerpt | P08 | F2 | check,check_writing | 3 | 已呈现 |
| life-a-A1-excerpt | P05 | F1a | check,check_writing | 13 | 已呈现 |
| life-a-A1-excerpt | P05 | F1b | check,check_writing | 5 | 已呈现 |
| life-a-A1-excerpt | P14 | F5a | check,check_writing | 9 | 已呈现 |
| life-a-A1-excerpt | P14 | F5b | check,check_writing | 5 | 已呈现 |
| life-a-A1-excerpt | P24 | F11a | check,check_writing | 11 | 已呈现 |
| life-a-A1-excerpt | P24 | F11b | check,check_writing | 7 | 已呈现 |
| life-a-A1-excerpt | P24 | F11c | check,check_writing | 3 | 已呈现 |
| life-a-A2-excerpt | P01 | F1a | writing,check,check_writing | 2 | 已呈现 |
| life-a-A2-excerpt | P06 | F2 | writing,check,check_writing | 2 | 已呈现 |
| life-a-A2-excerpt | P12 | F5a | writing,check,check_writing | 2 | 已呈现 |
| life-a-A2-excerpt | P02 | F1a | check,check_writing | 3 | 已呈现 |
| life-a-A2-excerpt | P22 | F11a | check,check_writing | 2 | 已呈现 |
| life-a-A2-excerpt | P09 | F3 | check,check_writing | 2 | 已呈现 |
| life-a-A2-excerpt | P23 | F11a | check,check_writing | 3 | 已呈现 |
| life-a-A2-excerpt | P23 | F11b | writing,check,check_writing | 4 | 已呈现 |
| life-a-A2-excerpt | P03 | F1a | check,check_writing | 4 | 已呈现 |
| life-a-A2-excerpt | P15 | F6 | check,check_writing | 2 | 已呈现 |
| life-a-A2-excerpt | P04 | F1a | check,check_writing | 5 | 已呈现 |
| life-a-A2-excerpt | P04 | F1b | writing,check,check_writing | 6 | 已呈现 |
| life-a-A2-excerpt | P07 | F2 | check,check_writing | 3 | 已呈现 |
| life-a-A2-excerpt | P25 | F12 | check,check_writing | 2 | 已呈现 |
| life-a-A2-excerpt | P13 | F5a | check,check_writing | 3 | 已呈现 |
| life-a-A2-excerpt | P13 | F5b | writing,check,check_writing | 4 | 已呈现 |
| life-a-A2-excerpt | P26 | M1 | check,check_writing | 2 | 已呈现 |
| life-a-A2-excerpt | P16 | F7 | check,check_writing | 1 | 已呈现 |
| life-a-A2-excerpt | P17 | F8 | check | 2 | 已呈现 |
| life-a-A2-excerpt | P18 | F9 | check,check_writing | 2 | 已呈现 |
| life-a-A2-excerpt | P19 | F9 | check,check_writing | 1 | 已呈现 |
| life-a-A2-excerpt | P28 | M3 | check,check_writing | 2 | 已呈现 |
| life-a-A2-excerpt | P10 | F3 | check,check_writing | 3 | 已呈现 |
| life-a-A2-excerpt | P20 | F10 | 无 | 不在前100 | no_overlap |
| life-a-A2-excerpt | P21 | F10 | check,check_writing | 1 | 已呈现 |
| life-a-A2-excerpt | P27 | M2a | check,check_writing | 5 | 已呈现 |
| life-a-A2-excerpt | P27 | M2b | check,check_writing | 1 | 已呈现 |
| life-a-A2-excerpt | P27 | M2c | check,check_writing | 2 | 已呈现 |
| life-a-A2-excerpt | P27 | M2d | writing,check,check_writing | 4 | 已呈现 |
| life-a-A2-excerpt | P11 | F4 | check,check_writing | 2 | 已呈现 |
| life-a-A2-excerpt | P08 | F2 | check,check_writing | 2 | 已呈现 |
| life-a-A2-excerpt | P05 | F1a | check,check_writing | 6 | 已呈现 |
| life-a-A2-excerpt | P05 | F1b | check,check_writing | 7 | 已呈现 |
| life-a-A2-excerpt | P14 | F5a | check,check_writing | 4 | 已呈现 |
| life-a-A2-excerpt | P14 | F5b | check,check_writing | 5 | 已呈现 |
| life-a-A2-excerpt | P24 | F11a | check,check_writing | 4 | 已呈现 |
| life-a-A2-excerpt | P24 | F11b | check,check_writing | 6 | 已呈现 |
| life-a-A2-excerpt | P24 | F11c | check,check_writing | 5 | 已呈现 |
| life-a-A0-none | P01 | F1a | 无 | 不在前100 | no_check |
| life-a-A0-none | P06 | F2 | 无 | 不在前100 | no_check |
| life-a-A0-none | P12 | F5a | 无 | 不在前100 | no_check |
| life-a-A0-none | P02 | F1a | 无 | 不在前100 | no_check |
| life-a-A0-none | P22 | F11a | 无 | 不在前100 | no_check |
| life-a-A0-none | P09 | F3 | 无 | 不在前100 | no_check |
| life-a-A0-none | P23 | F11a | 无 | 不在前100 | no_check |
| life-a-A0-none | P23 | F11b | 无 | 不在前100 | no_check |
| life-a-A0-none | P03 | F1a | 无 | 不在前100 | no_check |
| life-a-A0-none | P15 | F6 | 无 | 不在前100 | no_check |
| life-a-A0-none | P04 | F1a | 无 | 不在前100 | no_check |
| life-a-A0-none | P04 | F1b | 无 | 不在前100 | no_check |
| life-a-A0-none | P07 | F2 | 无 | 不在前100 | no_check |
| life-a-A0-none | P25 | F12 | 无 | 不在前100 | no_check |
| life-a-A0-none | P13 | F5a | 无 | 不在前100 | no_check |
| life-a-A0-none | P13 | F5b | 无 | 不在前100 | no_check |
| life-a-A0-none | P26 | M1 | 无 | 不在前100 | no_check |
| life-a-A0-none | P16 | F7 | 无 | 不在前100 | no_check |
| life-a-A0-none | P17 | F8 | 无 | 不在前100 | no_check |
| life-a-A0-none | P18 | F9 | 无 | 不在前100 | no_check |
| life-a-A0-none | P19 | F9 | 无 | 不在前100 | no_check |
| life-a-A0-none | P28 | M3 | 无 | 不在前100 | no_check |
| life-a-A0-none | P10 | F3 | 无 | 不在前100 | no_check |
| life-a-A0-none | P20 | F10 | 无 | 不在前100 | no_check |
| life-a-A0-none | P21 | F10 | 无 | 不在前100 | no_check |
| life-a-A0-none | P27 | M2a | 无 | 不在前100 | no_check |
| life-a-A0-none | P27 | M2b | 无 | 不在前100 | no_check |
| life-a-A0-none | P27 | M2c | 无 | 不在前100 | no_check |
| life-a-A0-none | P27 | M2d | 无 | 不在前100 | no_check |
| life-a-A0-none | P11 | F4 | 无 | 不在前100 | no_check |
| life-a-A0-none | P08 | F2 | 无 | 不在前100 | no_check |
| life-a-A0-none | P05 | F1a | 无 | 不在前100 | no_check |
| life-a-A0-none | P05 | F1b | 无 | 不在前100 | no_check |
| life-a-A0-none | P14 | F5a | 无 | 不在前100 | no_check |
| life-a-A0-none | P14 | F5b | 无 | 不在前100 | no_check |
| life-a-A0-none | P24 | F11a | 无 | 不在前100 | no_check |
| life-a-A0-none | P24 | F11b | 无 | 不在前100 | no_check |
| life-a-A0-none | P24 | F11c | 无 | 不在前100 | no_check |
| life-a-A2-none | P01 | F1a | check | 2 | 已呈现 |
| life-a-A2-none | P06 | F2 | check | 2 | 已呈现 |
| life-a-A2-none | P12 | F5a | check | 2 | 已呈现 |
| life-a-A2-none | P02 | F1a | check | 3 | 已呈现 |
| life-a-A2-none | P22 | F11a | check | 2 | 已呈现 |
| life-a-A2-none | P09 | F3 | check | 2 | 已呈现 |
| life-a-A2-none | P23 | F11a | check | 3 | 已呈现 |
| life-a-A2-none | P23 | F11b | check | 4 | 已呈现 |
| life-a-A2-none | P03 | F1a | check | 4 | 已呈现 |
| life-a-A2-none | P15 | F6 | check | 2 | 已呈现 |
| life-a-A2-none | P04 | F1a | check | 5 | 已呈现 |
| life-a-A2-none | P04 | F1b | check | 6 | 已呈现 |
| life-a-A2-none | P07 | F2 | check | 3 | 已呈现 |
| life-a-A2-none | P25 | F12 | check | 1 | 已呈现 |
| life-a-A2-none | P13 | F5a | check | 3 | 已呈现 |
| life-a-A2-none | P13 | F5b | check | 4 | 已呈现 |
| life-a-A2-none | P26 | M1 | check | 2 | 已呈现 |
| life-a-A2-none | P16 | F7 | check | 1 | 已呈现 |
| life-a-A2-none | P17 | F8 | check | 2 | 已呈现 |
| life-a-A2-none | P18 | F9 | check | 2 | 已呈现 |
| life-a-A2-none | P19 | F9 | check | 1 | 已呈现 |
| life-a-A2-none | P28 | M3 | check | 2 | 已呈现 |
| life-a-A2-none | P10 | F3 | check | 3 | 已呈现 |
| life-a-A2-none | P20 | F10 | 无 | 不在前100 | no_overlap |
| life-a-A2-none | P21 | F10 | check | 1 | 已呈现 |
| life-a-A2-none | P27 | M2a | check | 5 | 已呈现 |
| life-a-A2-none | P27 | M2b | check | 1 | 已呈现 |
| life-a-A2-none | P27 | M2c | check | 2 | 已呈现 |
| life-a-A2-none | P27 | M2d | check | 4 | 已呈现 |
| life-a-A2-none | P11 | F4 | check | 2 | 已呈现 |
| life-a-A2-none | P08 | F2 | check | 2 | 已呈现 |
| life-a-A2-none | P05 | F1a | check | 6 | 已呈现 |
| life-a-A2-none | P05 | F1b | check | 7 | 已呈现 |
| life-a-A2-none | P14 | F5a | check | 4 | 已呈现 |
| life-a-A2-none | P14 | F5b | check | 5 | 已呈现 |
| life-a-A2-none | P24 | F11a | check | 4 | 已呈现 |
| life-a-A2-none | P24 | F11b | check | 6 | 已呈现 |
| life-a-A2-none | P24 | F11c | check | 5 | 已呈现 |
| life-b-A0-excerpt | P01 | F1a | 无 | 不在前100 | no_check |
| life-b-A0-excerpt | P06 | F2 | 无 | 不在前100 | no_check |
| life-b-A0-excerpt | P12 | F5a | 无 | 不在前100 | no_check |
| life-b-A0-excerpt | P02 | F1a | 无 | 不在前100 | no_check |
| life-b-A0-excerpt | P22 | F11a | 无 | 不在前100 | no_check |
| life-b-A0-excerpt | P09 | F3 | 无 | 不在前100 | no_check |
| life-b-A0-excerpt | P23 | F11a | 无 | 不在前100 | no_check |
| life-b-A0-excerpt | P23 | F11b | 无 | 不在前100 | no_check |
| life-b-A0-excerpt | P03 | F1a | 无 | 不在前100 | no_check |
| life-b-A0-excerpt | P15 | F6 | 无 | 不在前100 | no_check |
| life-b-A0-excerpt | P04 | F1a | 无 | 不在前100 | no_check |
| life-b-A0-excerpt | P04 | F1b | 无 | 不在前100 | no_check |
| life-b-A0-excerpt | P07 | F2 | 无 | 不在前100 | no_check |
| life-b-A0-excerpt | P25 | F12 | 无 | 不在前100 | no_check |
| life-b-A0-excerpt | P13 | F5a | 无 | 不在前100 | no_check |
| life-b-A0-excerpt | P13 | F5b | 无 | 不在前100 | no_check |
| life-b-A0-excerpt | P26 | M1 | 无 | 不在前100 | no_check |
| life-b-A0-excerpt | P16 | F7 | 无 | 不在前100 | no_check |
| life-b-A0-excerpt | P17 | F8 | 无 | 不在前100 | no_check |
| life-b-A0-excerpt | P18 | F9 | 无 | 不在前100 | no_check |
| life-b-A0-excerpt | P19 | F9 | 无 | 不在前100 | no_check |
| life-b-A0-excerpt | P28 | M3 | 无 | 不在前100 | no_check |
| life-b-A0-excerpt | P10 | F3 | 无 | 不在前100 | no_check |
| life-b-A0-excerpt | P20 | F10 | 无 | 不在前100 | no_check |
| life-b-A0-excerpt | P21 | F10 | 无 | 不在前100 | no_check |
| life-b-A0-excerpt | P27 | M2a | 无 | 不在前100 | no_check |
| life-b-A0-excerpt | P27 | M2b | 无 | 不在前100 | no_check |
| life-b-A0-excerpt | P27 | M2c | 无 | 不在前100 | no_check |
| life-b-A0-excerpt | P27 | M2d | 无 | 不在前100 | no_check |
| life-b-A0-excerpt | P11 | F4 | 无 | 不在前100 | no_check |
| life-b-A0-excerpt | P08 | F2 | 无 | 不在前100 | no_check |
| life-b-A0-excerpt | P05 | F1a | 无 | 不在前100 | no_check |
| life-b-A0-excerpt | P05 | F1b | 无 | 不在前100 | no_check |
| life-b-A0-excerpt | P14 | F5a | 无 | 不在前100 | no_check |
| life-b-A0-excerpt | P14 | F5b | 无 | 不在前100 | no_check |
| life-b-A0-excerpt | P24 | F11a | 无 | 不在前100 | no_check |
| life-b-A0-excerpt | P24 | F11b | 无 | 不在前100 | no_check |
| life-b-A0-excerpt | P24 | F11c | 无 | 不在前100 | no_check |
| life-b-A1-excerpt | P01 | F1a | check,check_writing | 21 | 已呈现 |
| life-b-A1-excerpt | P06 | F2 | check,check_writing | 3 | 已呈现 |
| life-b-A1-excerpt | P12 | F5a | check,check_writing | 3 | 已呈现 |
| life-b-A1-excerpt | P02 | F1a | 无 | 不在前100 | recency_cut |
| life-b-A1-excerpt | P22 | F11a | check,check_writing | 3 | 已呈现 |
| life-b-A1-excerpt | P09 | F3 | 无 | 不在前100 | recency_cut |
| life-b-A1-excerpt | P23 | F11a | 无 | 不在前100 | recency_cut |
| life-b-A1-excerpt | P23 | F11b | 无 | 62 | recency_cut |
| life-b-A1-excerpt | P03 | F1a | 无 | 不在前100 | recency_cut |
| life-b-A1-excerpt | P15 | F6 | check,check_writing | 3 | 已呈现 |
| life-b-A1-excerpt | P04 | F1a | 无 | 不在前100 | recency_cut |
| life-b-A1-excerpt | P04 | F1b | check,check_writing | 38 | 已呈现 |
| life-b-A1-excerpt | P07 | F2 | check,check_writing | 5 | 已呈现 |
| life-b-A1-excerpt | P25 | F12 | check,check_writing | 2 | 已呈现 |
| life-b-A1-excerpt | P13 | F5a | check,check_writing | 7 | 已呈现 |
| life-b-A1-excerpt | P13 | F5b | check,check_writing | 3 | 已呈现 |
| life-b-A1-excerpt | P26 | M1 | check,check_writing | 3 | 已呈现 |
| life-b-A1-excerpt | P16 | F7 | check,check_writing | 2 | 已呈现 |
| life-b-A1-excerpt | P17 | F8 | check | 29 | 已呈现 |
| life-b-A1-excerpt | P18 | F9 | 无 | 55 | recency_cut |
| life-b-A1-excerpt | P19 | F9 | check,check_writing | 2 | 已呈现 |
| life-b-A1-excerpt | P28 | M3 | 无 | 不在前100 | substring_miss |
| life-b-A1-excerpt | P10 | F3 | 无 | 不在前100 | recency_cut |
| life-b-A1-excerpt | P20 | F10 | 无 | 不在前100 | substring_miss |
| life-b-A1-excerpt | P21 | F10 | check,check_writing | 2 | 已呈现 |
| life-b-A1-excerpt | P27 | M2a | check,check_writing | 9 | 已呈现 |
| life-b-A1-excerpt | P27 | M2b | check,check_writing | 7 | 已呈现 |
| life-b-A1-excerpt | P27 | M2c | check,check_writing | 5 | 已呈现 |
| life-b-A1-excerpt | P27 | M2d | check,check_writing | 3 | 已呈现 |
| life-b-A1-excerpt | P11 | F4 | check,check_writing | 3 | 已呈现 |
| life-b-A1-excerpt | P08 | F2 | check,check_writing | 3 | 已呈现 |
| life-b-A1-excerpt | P05 | F1a | 无 | 不在前100 | recency_cut |
| life-b-A1-excerpt | P05 | F1b | 无 | 不在前100 | recency_cut |
| life-b-A1-excerpt | P14 | F5a | check,check_writing | 9 | 已呈现 |
| life-b-A1-excerpt | P14 | F5b | check,check_writing | 5 | 已呈现 |
| life-b-A1-excerpt | P24 | F11a | 无 | 不在前100 | recency_cut |
| life-b-A1-excerpt | P24 | F11b | 无 | 不在前100 | recency_cut |
| life-b-A1-excerpt | P24 | F11c | 无 | 不在前100 | recency_cut |
| life-b-A2-excerpt | P01 | F1a | check,check_writing | 12 | 已呈现 |
| life-b-A2-excerpt | P06 | F2 | check,check_writing | 2 | 已呈现 |
| life-b-A2-excerpt | P12 | F5a | check,check_writing | 2 | 已呈现 |
| life-b-A2-excerpt | P02 | F1a | check | 32 | 已呈现 |
| life-b-A2-excerpt | P22 | F11a | check | 2 | 已呈现 |
| life-b-A2-excerpt | P09 | F3 | 无 | 44 | ranked_out |
| life-b-A2-excerpt | P23 | F11a | check | 3 | 已呈现 |
| life-b-A2-excerpt | P23 | F11b | check | 8 | 已呈现 |
| life-b-A2-excerpt | P03 | F1a | 无 | 71 | ranked_out |
| life-b-A2-excerpt | P15 | F6 | check,check_writing | 2 | 已呈现 |
| life-b-A2-excerpt | P04 | F1a | 无 | 86 | ranked_out |
| life-b-A2-excerpt | P04 | F1b | 无 | 不在前100 | ranked_out |
| life-b-A2-excerpt | P07 | F2 | check,check_writing | 3 | 已呈现 |
| life-b-A2-excerpt | P25 | F12 | check,check_writing | 2 | 已呈现 |
| life-b-A2-excerpt | P13 | F5a | check,check_writing | 3 | 已呈现 |
| life-b-A2-excerpt | P13 | F5b | check,check_writing | 4 | 已呈现 |
| life-b-A2-excerpt | P26 | M1 | check,check_writing | 2 | 已呈现 |
| life-b-A2-excerpt | P16 | F7 | check,check_writing | 1 | 已呈现 |
| life-b-A2-excerpt | P17 | F8 | 无 | 89 | ranked_out |
| life-b-A2-excerpt | P18 | F9 | check | 7 | 已呈现 |
| life-b-A2-excerpt | P19 | F9 | check,check_writing | 1 | 已呈现 |
| life-b-A2-excerpt | P28 | M3 | check | 2 | 已呈现 |
| life-b-A2-excerpt | P10 | F3 | 无 | 不在前100 | ranked_out |
| life-b-A2-excerpt | P20 | F10 | 无 | 不在前100 | no_overlap |
| life-b-A2-excerpt | P21 | F10 | check,check_writing | 1 | 已呈现 |
| life-b-A2-excerpt | P27 | M2a | check,check_writing | 5 | 已呈现 |
| life-b-A2-excerpt | P27 | M2b | check,check_writing | 1 | 已呈现 |
| life-b-A2-excerpt | P27 | M2c | check,check_writing | 2 | 已呈现 |
| life-b-A2-excerpt | P27 | M2d | check,check_writing | 4 | 已呈现 |
| life-b-A2-excerpt | P11 | F4 | check,check_writing | 2 | 已呈现 |
| life-b-A2-excerpt | P08 | F2 | check,check_writing | 2 | 已呈现 |
| life-b-A2-excerpt | P05 | F1a | 无 | 不在前100 | ranked_out |
| life-b-A2-excerpt | P05 | F1b | 无 | 不在前100 | ranked_out |
| life-b-A2-excerpt | P14 | F5a | check,check_writing | 4 | 已呈现 |
| life-b-A2-excerpt | P14 | F5b | check,check_writing | 5 | 已呈现 |
| life-b-A2-excerpt | P24 | F11a | check | 4 | 已呈现 |
| life-b-A2-excerpt | P24 | F11b | 无 | 51 | ranked_out |
| life-b-A2-excerpt | P24 | F11c | check | 13 | 已呈现 |

每次遗漏的复现命令（同一探针的多个答案共用一条命令）：

```sh
npm run eval -- explain .local-data/p8-baseline-F0vnyO/life-a-A0-excerpt P02
npm run eval -- explain .local-data/p8-baseline-F0vnyO/life-a-A0-excerpt P22
npm run eval -- explain .local-data/p8-baseline-F0vnyO/life-a-A0-excerpt P09
npm run eval -- explain .local-data/p8-baseline-F0vnyO/life-a-A0-excerpt P23
npm run eval -- explain .local-data/p8-baseline-F0vnyO/life-a-A0-excerpt P03
npm run eval -- explain .local-data/p8-baseline-F0vnyO/life-a-A0-excerpt P15
npm run eval -- explain .local-data/p8-baseline-F0vnyO/life-a-A0-excerpt P04
npm run eval -- explain .local-data/p8-baseline-F0vnyO/life-a-A0-excerpt P07
npm run eval -- explain .local-data/p8-baseline-F0vnyO/life-a-A0-excerpt P25
npm run eval -- explain .local-data/p8-baseline-F0vnyO/life-a-A0-excerpt P13
npm run eval -- explain .local-data/p8-baseline-F0vnyO/life-a-A0-excerpt P26
npm run eval -- explain .local-data/p8-baseline-F0vnyO/life-a-A0-excerpt P16
npm run eval -- explain .local-data/p8-baseline-F0vnyO/life-a-A0-excerpt P17
npm run eval -- explain .local-data/p8-baseline-F0vnyO/life-a-A0-excerpt P18
npm run eval -- explain .local-data/p8-baseline-F0vnyO/life-a-A0-excerpt P19
npm run eval -- explain .local-data/p8-baseline-F0vnyO/life-a-A0-excerpt P28
npm run eval -- explain .local-data/p8-baseline-F0vnyO/life-a-A0-excerpt P10
npm run eval -- explain .local-data/p8-baseline-F0vnyO/life-a-A0-excerpt P20
npm run eval -- explain .local-data/p8-baseline-F0vnyO/life-a-A0-excerpt P21
npm run eval -- explain .local-data/p8-baseline-F0vnyO/life-a-A0-excerpt P27
npm run eval -- explain .local-data/p8-baseline-F0vnyO/life-a-A0-excerpt P11
npm run eval -- explain .local-data/p8-baseline-F0vnyO/life-a-A0-excerpt P08
npm run eval -- explain .local-data/p8-baseline-F0vnyO/life-a-A0-excerpt P05
npm run eval -- explain .local-data/p8-baseline-F0vnyO/life-a-A0-excerpt P14
npm run eval -- explain .local-data/p8-baseline-F0vnyO/life-a-A0-excerpt P24
npm run eval -- explain .local-data/p8-baseline-F0vnyO/life-a-A1-excerpt P28
npm run eval -- explain .local-data/p8-baseline-F0vnyO/life-a-A1-excerpt P20
npm run eval -- explain .local-data/p8-baseline-F0vnyO/life-a-A2-excerpt P20
npm run eval -- explain .local-data/p8-baseline-F0vnyO/life-a-A0-none P01
npm run eval -- explain .local-data/p8-baseline-F0vnyO/life-a-A0-none P06
npm run eval -- explain .local-data/p8-baseline-F0vnyO/life-a-A0-none P12
npm run eval -- explain .local-data/p8-baseline-F0vnyO/life-a-A0-none P02
npm run eval -- explain .local-data/p8-baseline-F0vnyO/life-a-A0-none P22
npm run eval -- explain .local-data/p8-baseline-F0vnyO/life-a-A0-none P09
npm run eval -- explain .local-data/p8-baseline-F0vnyO/life-a-A0-none P23
npm run eval -- explain .local-data/p8-baseline-F0vnyO/life-a-A0-none P03
npm run eval -- explain .local-data/p8-baseline-F0vnyO/life-a-A0-none P15
npm run eval -- explain .local-data/p8-baseline-F0vnyO/life-a-A0-none P04
npm run eval -- explain .local-data/p8-baseline-F0vnyO/life-a-A0-none P07
npm run eval -- explain .local-data/p8-baseline-F0vnyO/life-a-A0-none P25
npm run eval -- explain .local-data/p8-baseline-F0vnyO/life-a-A0-none P13
npm run eval -- explain .local-data/p8-baseline-F0vnyO/life-a-A0-none P26
npm run eval -- explain .local-data/p8-baseline-F0vnyO/life-a-A0-none P16
npm run eval -- explain .local-data/p8-baseline-F0vnyO/life-a-A0-none P17
npm run eval -- explain .local-data/p8-baseline-F0vnyO/life-a-A0-none P18
npm run eval -- explain .local-data/p8-baseline-F0vnyO/life-a-A0-none P19
npm run eval -- explain .local-data/p8-baseline-F0vnyO/life-a-A0-none P28
npm run eval -- explain .local-data/p8-baseline-F0vnyO/life-a-A0-none P10
npm run eval -- explain .local-data/p8-baseline-F0vnyO/life-a-A0-none P20
npm run eval -- explain .local-data/p8-baseline-F0vnyO/life-a-A0-none P21
npm run eval -- explain .local-data/p8-baseline-F0vnyO/life-a-A0-none P27
npm run eval -- explain .local-data/p8-baseline-F0vnyO/life-a-A0-none P11
npm run eval -- explain .local-data/p8-baseline-F0vnyO/life-a-A0-none P08
npm run eval -- explain .local-data/p8-baseline-F0vnyO/life-a-A0-none P05
npm run eval -- explain .local-data/p8-baseline-F0vnyO/life-a-A0-none P14
npm run eval -- explain .local-data/p8-baseline-F0vnyO/life-a-A0-none P24
npm run eval -- explain .local-data/p8-baseline-F0vnyO/life-a-A2-none P20
npm run eval -- explain .local-data/p8-baseline-F0vnyO/life-b-A0-excerpt P01
npm run eval -- explain .local-data/p8-baseline-F0vnyO/life-b-A0-excerpt P06
npm run eval -- explain .local-data/p8-baseline-F0vnyO/life-b-A0-excerpt P12
npm run eval -- explain .local-data/p8-baseline-F0vnyO/life-b-A0-excerpt P02
npm run eval -- explain .local-data/p8-baseline-F0vnyO/life-b-A0-excerpt P22
npm run eval -- explain .local-data/p8-baseline-F0vnyO/life-b-A0-excerpt P09
npm run eval -- explain .local-data/p8-baseline-F0vnyO/life-b-A0-excerpt P23
npm run eval -- explain .local-data/p8-baseline-F0vnyO/life-b-A0-excerpt P03
npm run eval -- explain .local-data/p8-baseline-F0vnyO/life-b-A0-excerpt P15
npm run eval -- explain .local-data/p8-baseline-F0vnyO/life-b-A0-excerpt P04
npm run eval -- explain .local-data/p8-baseline-F0vnyO/life-b-A0-excerpt P07
npm run eval -- explain .local-data/p8-baseline-F0vnyO/life-b-A0-excerpt P25
npm run eval -- explain .local-data/p8-baseline-F0vnyO/life-b-A0-excerpt P13
npm run eval -- explain .local-data/p8-baseline-F0vnyO/life-b-A0-excerpt P26
npm run eval -- explain .local-data/p8-baseline-F0vnyO/life-b-A0-excerpt P16
npm run eval -- explain .local-data/p8-baseline-F0vnyO/life-b-A0-excerpt P17
npm run eval -- explain .local-data/p8-baseline-F0vnyO/life-b-A0-excerpt P18
npm run eval -- explain .local-data/p8-baseline-F0vnyO/life-b-A0-excerpt P19
npm run eval -- explain .local-data/p8-baseline-F0vnyO/life-b-A0-excerpt P28
npm run eval -- explain .local-data/p8-baseline-F0vnyO/life-b-A0-excerpt P10
npm run eval -- explain .local-data/p8-baseline-F0vnyO/life-b-A0-excerpt P20
npm run eval -- explain .local-data/p8-baseline-F0vnyO/life-b-A0-excerpt P21
npm run eval -- explain .local-data/p8-baseline-F0vnyO/life-b-A0-excerpt P27
npm run eval -- explain .local-data/p8-baseline-F0vnyO/life-b-A0-excerpt P11
npm run eval -- explain .local-data/p8-baseline-F0vnyO/life-b-A0-excerpt P08
npm run eval -- explain .local-data/p8-baseline-F0vnyO/life-b-A0-excerpt P05
npm run eval -- explain .local-data/p8-baseline-F0vnyO/life-b-A0-excerpt P14
npm run eval -- explain .local-data/p8-baseline-F0vnyO/life-b-A0-excerpt P24
npm run eval -- explain .local-data/p8-baseline-F0vnyO/life-b-A1-excerpt P02
npm run eval -- explain .local-data/p8-baseline-F0vnyO/life-b-A1-excerpt P09
npm run eval -- explain .local-data/p8-baseline-F0vnyO/life-b-A1-excerpt P23
npm run eval -- explain .local-data/p8-baseline-F0vnyO/life-b-A1-excerpt P03
npm run eval -- explain .local-data/p8-baseline-F0vnyO/life-b-A1-excerpt P04
npm run eval -- explain .local-data/p8-baseline-F0vnyO/life-b-A1-excerpt P18
npm run eval -- explain .local-data/p8-baseline-F0vnyO/life-b-A1-excerpt P28
npm run eval -- explain .local-data/p8-baseline-F0vnyO/life-b-A1-excerpt P10
npm run eval -- explain .local-data/p8-baseline-F0vnyO/life-b-A1-excerpt P20
npm run eval -- explain .local-data/p8-baseline-F0vnyO/life-b-A1-excerpt P05
npm run eval -- explain .local-data/p8-baseline-F0vnyO/life-b-A1-excerpt P24
npm run eval -- explain .local-data/p8-baseline-F0vnyO/life-b-A2-excerpt P09
npm run eval -- explain .local-data/p8-baseline-F0vnyO/life-b-A2-excerpt P03
npm run eval -- explain .local-data/p8-baseline-F0vnyO/life-b-A2-excerpt P04
npm run eval -- explain .local-data/p8-baseline-F0vnyO/life-b-A2-excerpt P17
npm run eval -- explain .local-data/p8-baseline-F0vnyO/life-b-A2-excerpt P10
npm run eval -- explain .local-data/p8-baseline-F0vnyO/life-b-A2-excerpt P20
npm run eval -- explain .local-data/p8-baseline-F0vnyO/life-b-A2-excerpt P05
npm run eval -- explain .local-data/p8-baseline-F0vnyO/life-b-A2-excerpt P24
```

## 限制与 WP-E 的问题

P20/R13 的换说法失败按原样保留。假模型不理解整理文字，结果不能说明真实模型如何查询或使用记忆（H7）。原文窗口与文字预算未为这些探针调整。WP-E 应与本基线比较：跨天连续性的改变（H1）、增加浮现后的呈现增益和闯入（H2）、真实模型是否自行查询（H7）；需要另行批准真实模型实验。
