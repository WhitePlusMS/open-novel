# 子任务 01：数据模型与状态规范

## 目标
- 统一“完成结轮/到时结轮”的状态模型
- 明确缺口记录的数据结构与归属
- 兼容 dev/test/prod 环境，提供过渡期最低实现方案

## 背景与现状
- 当前轮次推进与任务执行主要依赖 [season-auto-advance.service.ts](file:///e:/比赛/secondme/prj2on/src/services/season-auto-advance.service.ts) 与 [task-worker.service.ts](file:///e:/比赛/secondme/prj2on/src/services/task-worker.service.ts)
- 目前缺少“轮次完成/到时完成”的统一记录与缺口表
- 任务失败到达重试上限后仅标记 FAILED，未将缺口结构化记录

## 交付范围
- 新增数据表：
  - SeasonRound：每轮状态与时间戳
  - RoundGap：本轮缺口记录
- TaskQueue 新增字段：seasonId / round / step
- Season 表仅保留当前轮次快照字段

## 具体设计
### 1) SeasonRound（方案 A）
- 字段建议：
  - seasonId, round
  - status（RUNNING/COMPLETED/TIMED_OUT）
  - startedAt, endedAt
  - aiWorkStartAt, aiWorkEndAt
  - readingStartAt, readingEndAt
  - outlineStatus, chapterStatus, commentStatus, gapCheckStatus
  - timedOutAt

### 2) RoundGap（方案 A）
- 字段建议：
  - seasonId, round, bookId, chapterNumber
  - gapType（OUTLINE/CHAPTER）
  - status（OPEN/RESOLVED）
  - detectedAt, resolvedAt
  - source（ROUND_CYCLE/FAILURE/TIMEOUT）

### 3) TaskQueue 结构调整（方案 A）
- 新增显式字段：
  - seasonId, round, step
- 唯一性约束：
  - 同赛季同轮次同步骤只允许一个任务

### 4) 过渡期最低实现字段（方案 B）
- Season 表新增：
  - timedOutAt
  - roundDoneAt 或 roundStatus
  - roundGaps（JSON）

## 实施步骤
1. 在 [schema.prisma](file:///e:/比赛/secondme/prj2on/prisma/schema.prisma) 增加 SeasonRound 与 RoundGap 模型，并补齐索引与唯一约束（seasonId + round、seasonId + round + bookId + chapterNumber）。
2. 在 TaskQueue 模型中增加 seasonId、round、step 字段，并保留 payload（用于任务参数），同时为 (seasonId, round, step, taskType, status) 增加索引或唯一约束满足去重需求。
3. 生成 Prisma 迁移并在 dev/test/prod 执行，确保已有 Season/TaskQueue 数据不丢失且可回滚。
4. 在 [task-queue.service.ts](file:///e:/比赛/secondme/prj2on/src/services/task-queue.service.ts) 增加对新字段的写入与读取，替换 JSON path 去重条件。
5. 在 [season-auto-advance.service.ts](file:///e:/比赛/secondme/prj2on/src/services/season-auto-advance.service.ts) 与 [task-worker.service.ts](file:///e:/比赛/secondme/prj2on/src/services/task-worker.service.ts) 中补齐 SeasonRound/RoundGap 的基础读写入口（只读写，不引入新流程）。

## 验收标准
- 可以通过数据结构区分：正常完成 / 到时完成
- 能够记录轮次缺口并在下一轮读取
- 任务去重无需依赖 payload JSON 解析

## 关联文件
- [schema.prisma](file:///e:/比赛/secondme/prj2on/prisma/schema.prisma)
- [task-queue.service.ts](file:///e:/比赛/secondme/prj2on/src/services/task-queue.service.ts)
- [season-auto-advance.service.ts](file:///e:/比赛/secondme/prj2on/src/services/season-auto-advance.service.ts)
