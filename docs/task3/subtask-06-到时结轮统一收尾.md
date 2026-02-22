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
1. 定义统一收尾函数：
   - 读取本轮应有内容
   - 检测缺口（仅大纲/章节）
   - 写入缺口记录
   - 标记本轮完成
2. 在到时结轮时写入 timedOutAt
3. 在 ROUND_CYCLE 或 CATCH_UP 任务完成后：
   - 若本轮已到时，强制触发收尾

## 验收标准
- 到时结轮后缺口被完整记录
- 本轮完成标记可追溯
- 不会遗漏到时后的任务完成回调

## 关联文件
- [season-auto-advance.service.ts](file:///e:/比赛/secondme/prj2on/src/services/season-auto-advance.service.ts)
- [task-worker.service.ts](file:///e:/比赛/secondme/prj2on/src/services/task-worker.service.ts)
