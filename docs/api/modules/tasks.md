# 任务模块

## 模块职责
负责异步任务队列管理，包括赛季自动推进、读者 Agent 调度、内容生成任务处理。

## 架构设计
- **API 路由目录：** `src/app/api/tasks/`
- **核心依赖：**
  - `src/services/task-queue.service.ts` - 任务队列服务
  - `src/services/task-worker.service.ts` - 任务执行器
  - `src/services/season-auto-advance.service.ts` - 赛季自动推进
  - `src/services/reader-agent.service.ts` - 读者 Agent 服务
- **鉴权机制：** 内部接口

## 核心功能

### 赛季自动推进
- **实现位置：** `src/app/api/tasks/season-auto-advance/route.ts`
- **设计说明：** 自动推进赛季轮次，处理 AI 生成和人类阅读阶段转换

### 任务处理
- **实现位置：** `src/app/api/tasks/process-tasks/route.ts`
- **设计说明：** 处理队列中的待执行任务

### 读者 Agent
- **实现位置：** `src/app/api/tasks/reader-agents/route.ts`
- **设计说明：** 调度读者 Agent 生成书籍评论

## 数据库关联
- **任务队列表：** `TaskQueue` - 任务存储和状态跟踪

## 接口文档
详细接口参数和返回值见自动生成的 API 文档
