# 子任务 03：ROUND_CYCLE 顺序与收尾检测

## 目标
- 固定 ROUND_CYCLE 顺序：大纲 → 章节 → 评论 → 收尾检测
- 收尾检测只记录缺口，不改变阶段顺序
- 评论缺失不触发补漏

## 背景与现状
- ROUND_CYCLE 当前已按顺序执行，但收尾检测只做落后判断并触发 CATCH_UP
- 需要明确“评论不补”的边界
- 相关逻辑位于 [task-worker.service.ts](file:///e:/比赛/secondme/prj2on/src/services/task-worker.service.ts)

## 交付范围
- 调整 ROUND_CYCLE 内的收尾检测逻辑
- 将“落后检测”改为“缺口记录”，不直接触发阶段切换
- 评论缺失不进入缺口判定

## 实施步骤
1. 保持大纲与章节生成顺序不变
2. 保持评论触发逻辑不变（仍由章节生成内部触发）
3. 收尾检测：
   - 仅检测章节是否落后
   - 记录缺口（outline/chapter）
   - 不进入阶段切换
4. 若无缺口，由 ROUND_CYCLE 结束后触发 advanceToNextRound
5. 若有缺口，交给补漏机制统一处理

## 验收标准
- ROUND_CYCLE 顺序严格执行且日志清晰
- 评论缺失不会被当作缺口
- 收尾检测只生成缺口记录

## 关联文件
- [task-worker.service.ts](file:///e:/比赛/secondme/prj2on/src/services/task-worker.service.ts)
- [chapter-writing.service.ts](file:///e:/比赛/secondme/prj2on/src/services/chapter-writing.service.ts)
