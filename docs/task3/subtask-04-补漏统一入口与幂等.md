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
1. 在进入新一轮 AI_WORKING 前读取上一轮缺口
2. 对缺口执行补漏：
   - 缺大纲 → 补大纲
   - 缺章节 → 补章节
3. 在章节写作流程中，如果发现缺口则即时补
4. 所有补漏动作必须幂等：
   - 已存在内容不重复生成
   - 已记录缺口不会重复写入

## 验收标准
- 新轮次开始前缺口必被处理一次
- 执行中发现缺口可即时补
- 不会重复补写已完成内容

## 关联文件
- [chapter-writing.service.ts](file:///e:/比赛/secondme/prj2on/src/services/chapter-writing.service.ts)
- [task-worker.service.ts](file:///e:/比赛/secondme/prj2on/src/services/task-worker.service.ts)
