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
1. 在 [task-worker.service.ts](file:///e:/比赛/secondme/prj2on/src/services/task-worker.service.ts) 保持 ROUND_CYCLE 的现有顺序：大纲 → 章节 → 评论（由 writeChaptersForSeason 内部触发）。
2. 将“落后检测”从“创建 CATCH_UP 任务”改为“写入 RoundGap 记录”，只基于章节落后（保留现有 currentChapters < round 的判断）。
3. 收尾检测不触发阶段切换：缺口记录完成后直接结束 ROUND_CYCLE，由统一收尾逻辑决定是否推进阶段。
4. 当缺口为空时，ROUND_CYCLE 执行完毕后调用 advanceToNextRound；当缺口存在时，仅记录并交给补漏入口处理。

## 验收标准
- ROUND_CYCLE 顺序严格执行且日志清晰
- 评论缺失不会被当作缺口
- 收尾检测只生成缺口记录

## 关联文件
- [task-worker.service.ts](file:///e:/比赛/secondme/prj2on/src/services/task-worker.service.ts)
- [chapter-writing.service.ts](file:///e:/比赛/secondme/prj2on/src/services/chapter-writing.service.ts)
