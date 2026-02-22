# 子任务 05：任务去重与失败策略

## 目标
- 去除基于 payload JSON 的去重歧义
- 失败达到重试上限后自动记录缺口
- 到时后的补跑仍受最大重试次数限制

## 背景与现状
- 任务去重依赖 payload JSON path 条件
- 失败到达上限只标记 FAILED，未产生缺口记录
- 相关逻辑位于 [task-queue.service.ts](file:///e:/比赛/secondme/prj2on/src/services/task-queue.service.ts)

## 交付范围
- TaskQueue 增加显式字段 seasonId/round/step
- 去重逻辑改为显式字段判断
- 永久失败时写入缺口记录（RoundGap 或过渡字段）

## 实施步骤
1. 在 TaskQueue 模型中新增字段并迁移
2. 修改 create 去重逻辑为显式字段
3. 修改 fail 逻辑：
   - 未到上限继续重试
   - 到达上限写入缺口并标记 FAILED
4. 到时后的补跑严格遵守 maxAttempts

## 验收标准
- 相同赛季/轮次/步骤不会重复创建任务
- 失败到达上限时缺口被记录
- maxAttempts 行为在 dev/test/prod 一致

## 关联文件
- [task-queue.service.ts](file:///e:/比赛/secondme/prj2on/src/services/task-queue.service.ts)
- [schema.prisma](file:///e:/比赛/secondme/prj2on/prisma/schema.prisma)
