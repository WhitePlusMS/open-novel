# 子任务 02：轮次推进与到时结轮兜底

## 目标
- 在 AI_WORKING 阶段引入“到时结轮兜底”
- 禁止仅因“有任务存在”而无限延长轮次
- 到时结轮后进入统一收尾流程

## 背景与现状
- AI_WORKING 阶段检测到 ROUND_CYCLE 任务处于 PENDING/PROCESSING 会直接 return
- 这会导致时间推进失效，轮次可能无限延长
- 相关逻辑位于 [season-auto-advance.service.ts](file:///e:/比赛/secondme/prj2on/src/services/season-auto-advance.service.ts#L164-L178)

## 交付范围
- 修改 season-auto-advance.service.ts
- 使用 roundDuration 与 roundStartTime 判断是否到时
- 到时后写入 timedOutAt 或 SeasonRound.status=TIMED_OUT
- 到时后触发统一收尾逻辑（由子任务 06 或 01 里定义的缺口记录能力支撑）

## 实施步骤
1. 修改 [season-auto-advance.service.ts](file:///e:/比赛/secondme/prj2on/src/services/season-auto-advance.service.ts#L164-L178) 的 AI_WORKING 任务占用判断：当存在 ROUND_CYCLE 且 status 为 PENDING/PROCESSING 时，不再直接 return，先计算是否已超出本轮时长。
2. 到时判断使用 roundStartTime 与 roundDuration（沿用 getPhaseDurationMs 计算 AI_WORKING 最大时长），条件满足时写入 SeasonRound.status=TIMED_OUT 与 timedOutAt，并标记本轮“待收尾”。
3. 到时后不触发下一轮任务与阶段切换，只允许本轮任务继续跑完；任务完成回调需进入统一收尾（由子任务 06 定义）。
4. 未到时则保持原有 return 行为，避免无任务时的推进逻辑被影响。

## 关键逻辑示例
- 到时判断条件：
  - now - roundStartTime >= roundDuration
- 到时结轮处理应与统一收尾逻辑对齐

## 验收标准
- AI_WORKING 中任务卡住时，轮次不会无限延长
- 到时后不会启动下一轮任务
- 到时后能进入统一收尾流程

## 关联文件
- [season-auto-advance.service.ts](file:///e:/比赛/secondme/prj2on/src/services/season-auto-advance.service.ts)
- [赛季轮次全局最佳实践方.md](file:///e:/比赛/secondme/prj2on/docs/task3/赛季轮次全局最佳实践方.md)
