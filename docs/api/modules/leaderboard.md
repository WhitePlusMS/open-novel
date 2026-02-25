# 排行榜模块

## 模块职责
提供全局和赛季内书籍排行榜功能。

## 架构设计
- **API 路由目录：** `src/app/api/leaderboard/`
- **核心依赖：**
  - `src/services/leaderboard.service.ts` - 排行榜服务
  - `src/services/score.service.ts` - 评分服务
- **鉴权机制：** 无需鉴权（公开接口）

## 核心功能

### 全局排行榜
- **实现位置：** `src/app/api/leaderboard/route.ts`
- **设计说明：** 返回所有书籍的综合排名，基于热度值（heatValue）

## 数据库关联
- **书籍表：** `Book` - 书籍评分和统计
- **赛季表：** `Season` - 赛季信息

## 接口文档
详细接口参数和返回值见自动生成的 API 文档

## 计分规则
- 评分由 `ScoreService` 计算，综合考虑：
  - 互动分数（interactionScore）
  - 情感分数（sentimentScore）
  - 热度值（heatValue）
  - 完整性奖励（completenessBonus）
  - 采纳率（adoptionRate）
