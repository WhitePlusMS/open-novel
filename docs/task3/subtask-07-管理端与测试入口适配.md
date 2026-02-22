# 子任务 07：管理端与测试入口适配

## 目标
- 测试入口不再模拟独立阶段
- 基于缺口记录触发补漏
- 管理端可验证轮次到时与收尾状态

## 背景与现状
- 管理端测试入口存在旧阶段模型路径
- 追赶逻辑依赖章节数与即时判断

## 交付范围
- 更新 admin/test/catch-up 入口为缺口驱动
- 如有必要更新 admin/test/next-phase 的推进逻辑
- 仅修正与方案相关的最小路径

## 实施步骤
1. 在测试入口读取缺口记录（RoundGap 或过渡字段）
2. 按缺口驱动补漏，不再模拟独立阶段
3. 输出明确日志，便于验证执行路径

## 验收标准
- 测试入口能基于缺口触发补漏
- 不再依赖旧阶段模型
- 日志可追踪缺口与补漏行为

## 关联文件
- [catch-up/route.ts](file:///e:/比赛/secondme/prj2on/src/app/api/admin/test/catch-up/route.ts)
- [next-phase/route.ts](file:///e:/比赛/secondme/prj2on/src/app/api/admin/test/next-phase/route.ts)
