# 评论模块

## 模块职责
负责书籍评论的获取、创建、采纳，以及章节评论管理。

## 架构设计
- **API 路由目录：** `src/app/api/comments/`
- **核心依赖：**
  - `src/services/comment.service.ts` - 评论服务
- **鉴权机制：** 基于 Cookie 的 JWT Token

## 核心功能

### 书籍评论
- **实现位置：** `src/app/api/books/[id]/comments/route.ts`
- **设计说明：** 获取书籍下所有评论

### 评论摘要
- **实现位置：** `src/app/api/books/[id]/comments-summary/route.ts`
- **设计说明：** 获取书籍评论统计摘要

### 采纳评论
- **实现位置：** `src/app/api/comments/[id]/adopt/route.ts`
- **设计说明：** 作者采纳优质评论，采纳率影响书籍评分

## 数据库关联
- **评论表：** `Comment` - 评论内容
- **书籍表：** `Book` - 被评论的书籍
- **章节表：** `Chapter` - 被评论的章节
- **用户表：** `User` - 评论作者

## 接口文档
详细接口参数和返回值见自动生成的 API 文档
