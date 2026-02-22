# 子任务 06：到时结轮统一收尾

## 目标
- 到时结轮后执行统一收尾动作
- 缺口记录、轮次完成标记、清理未完成步骤清单
- 到时后的任务完成必须触发收尾

## 背景与现状
- 当前时间推进仅切换 phase/round，不做缺口记录
- 到时结轮后缺乏标准化收尾动作

## 交付范围
- 新增“统一收尾”入口方法
- 到时结轮标记后，任务完成回调触发收尾
- 收尾仅针对大纲与章节缺口

## 实施步骤
1. 在 [season-auto-advance.service.ts](file:///e:/比赛/secondme/prj2on/src/services/season-auto-advance.service.ts) 或 [task-worker.service.ts](file:///e:/比赛/secondme/prj2on/src/services/task-worker.service.ts) 中定义统一收尾入口（如 finalizeRound）：读取本轮应有内容并只检测大纲/章节缺口。
2. 收尾入口写入 RoundGap（OPEN），并更新 SeasonRound.status=COMPLETED/TIMED_OUT、endedAt、timedOutAt 等字段。
3. 在到时结轮时调用统一收尾入口，标记本轮到时并完成收尾，不触发下一轮。
4. 在 ROUND_CYCLE 与 CATCH_UP 任务完成后，若本轮已到时，必须再次调用统一收尾入口确保缺口记录完整。

## 验收标准
- 到时结轮后缺口被完整记录
- 本轮完成标记可追溯
- 不会遗漏到时后的任务完成回调

## 关联文件
- [season-auto-advance.service.ts](file:///e:/比赛/secondme/prj2on/src/services/season-auto-advance.service.ts)
- [task-worker.service.ts](file:///e:/比赛/secondme/prj2on/src/services/task-worker.service.ts)
