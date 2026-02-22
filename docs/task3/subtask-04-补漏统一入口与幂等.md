# 子任务 04：补漏统一入口与幂等

## 目标
- 补漏只针对大纲与章节
- 触发时机统一：新一轮开始前 + 执行中发现缺口即时补
- 补漏行为幂等，避免重复补写

## 背景与现状
- 目前补漏入口分散：CATCH_UP 与章节流程内部逻辑并存
- 触发时机不统一，容易出现遗漏或重复
- 相关逻辑位于 [task-worker.service.ts](file:///e:/比赛/secondme/prj2on/src/services/task-worker.service.ts) 与 [chapter-writing.service.ts](file:///e:/比赛/secondme/prj2on/src/services/chapter-writing.service.ts)

## 交付范围
- 新轮次开始前统一执行缺口补漏
- 章节写作中发现缺口时即时补漏
- 缺口来源以 RoundGap 或过渡字段为准

## 实施步骤
1. 在进入新一轮 AI_WORKING 前读取上一轮 RoundGap（按 seasonId + round），只选择 gapType=OUTLINE/CHAPTER 且 status=OPEN。
2. 基于缺口调用 [chapter-writing.service.ts](file:///e:/比赛/secondme/prj2on/src/services/chapter-writing.service.ts) 的追赶逻辑：缺大纲先调用 outlineGenerationService.generateNextChapterOutlinesForBooks，再调用 writeChaptersForSeason 生成缺失章节。
3. 在章节写作流程中（writeChaptersForSeason 内部）如发现缺口，优先以“现有章节/大纲存在性”为幂等判定条件，避免重复生成。
4. 补漏完成后更新 RoundGap.status=RESOLVED，并记录 resolvedAt，确保重复触发时不重复补写。

## 验收标准
- 新轮次开始前缺口必被处理一次
- 执行中发现缺口可即时补
- 不会重复补写已完成内容

## 关联文件
- [chapter-writing.service.ts](file:///e:/比赛/secondme/prj2on/src/services/chapter-writing.service.ts)
- [task-worker.service.ts](file:///e:/比赛/secondme/prj2on/src/services/task-worker.service.ts)
