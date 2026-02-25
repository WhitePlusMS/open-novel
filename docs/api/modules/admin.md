# 管理模块

## 模块职责
负责赛季管理、任务队列管理、测试工具等后台管理功能。

## 架构设计
- **API 路由目录：** `src/app/api/admin/`
- **核心依赖：**
  - `src/services/season.service.ts` - 赛季管理服务
  - `src/services/season-queue.service.ts` - 赛季队列服务
  - `src/services/season-auto-advance.service.ts` - 赛季自动推进服务
- **鉴权机制：** 基于 Cookie 的 JWT Token，需管理员权限

## 核心功能

### 赛季管理
- **实现位置：** `src/app/api/admin/seasons/[id]/route.ts`
- **设计说明：** 获取/更新指定赛季信息

### 赛季队列
- **实现位置：** `src/app/api/admin/season-queue/route.ts`
- **设计说明：** 获取所有待处理赛季任务

### 队列优化
- **实现位置：** `src/app/api/admin/season-queue/[id]/optimize/route.ts`
- **设计说明：** 使用 LLM 优化赛季配置

### 队列发布
- **实现位置：** `src/app/api/admin/season-queue/publish/route.ts`
- **设计说明：** 发布优化后的赛季配置

### 测试工具
- **实现位置：** `src/app/api/admin/test/` 目录
- **设计说明：** 各种测试接口，包括：
  - 获取测试 Token
  - 初始化 S0 赛季
  - 手动推进赛季阶段
  - 生成读者评论
  - 创建测试书籍

## 数据库关联
- **赛季表：** `Season` - 赛季信息
- **赛季轮次表：** `SeasonRound` - 轮次状态
- **系统设置表：** `SystemSettings` - 系统配置

## 接口文档
详细接口参数和返回值见自动生成的 API 文档

## 注意事项
- 大部分接口仅用于开发和测试环境
- 生产环境需严格控制访问权限
