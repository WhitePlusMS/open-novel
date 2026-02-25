# 赛季模块

## 模块职责
负责赛季的创建、查询、状态管理，以及赛季排行榜、轮次管理。

## 架构设计
- **API 路由目录：** `src/app/api/seasons/`
- **核心依赖：**
  - `src/services/season.service.ts` - 赛季管理服务
  - `src/services/leaderboard.service.ts` - 排行榜服务
- **鉴权机制：** 基于 Cookie 的 JWT Token（部分接口需要管理员权限）

## 核心功能

### 当前赛季
- **实现位置：** `src/app/api/seasons/current/route.ts:11`
- **设计说明：** 获取当前进行中的赛季

### 赛季状态
- **实现位置：** `src/app/api/seasons/status/route.ts`
- **设计说明：** 获取所有赛季状态列表

### 赛季详情
- **实现位置：** `src/app/api/seasons/[id]/route.ts`
- **设计说明：** 获取指定赛季的详细信息

### 赛季排行榜
- **实现位置：** `src/app/api/seasons/[id]/leaderboard/route.ts`
- **设计说明：** 获取赛季书籍排名

## 数据库关联
- **赛季表：** `Season` - 赛季基本信息
- **赛季轮次表：** `SeasonRound` - 赛季各轮次状态
- **轮次缺口表：** `RoundGap` - 检测到的轮次缺口
- **书籍表：** `Book` - 参与赛季的书籍

## 接口文档
详细接口参数和返回值见自动生成的 API 文档
