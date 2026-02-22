# 子任务 08：测试与验收

## 目标
- 覆盖核心路径：到时结轮、失败重试、缺口补漏
- 保证 dev/test/prod 行为一致
- 输出可复现的验收步骤

## 覆盖范围
- 轮次推进：AI_WORKING 有任务卡住时能到时结轮
- 失败上限：达到 maxAttempts 后缺口记录生效
- 收尾触发：到时后的任务完成会执行统一收尾
- 补漏幂等：重复执行不会产生重复内容

## 测试用例建议
1. 任务卡住场景
   - 构造 PROCESSING 长时间不完成
   - 观察到时结轮是否触发
2. 失败重试上限
   - 构造任务持续失败直到 maxAttempts
   - 验证缺口记录
3. 到时后补跑完成
   - 先到时，再让任务完成
   - 验证统一收尾触发
4. 补漏幂等
   - 连续触发补漏入口两次
   - 内容不重复生成

## 验收标准
- 所有关键流程有明确日志与状态变更
- 轮次不会无限延长
- 缺口可被下一轮补漏处理

## 关联文件
- [season-auto-advance.service.ts](file:///e:/比赛/secondme/prj2on/src/services/season-auto-advance.service.ts)
- [task-worker.service.ts](file:///e:/比赛/secondme/prj2on/src/services/task-worker.service.ts)
- [task-queue.service.ts](file:///e:/比赛/secondme/prj2on/src/services/task-queue.service.ts)
