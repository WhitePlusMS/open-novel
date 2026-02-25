# 书籍模块

## 模块职责
负责书籍的创建、查询、更新、删除，以及章节管理、大纲生成、收藏、点赞、催更等核心功能。

## 架构设计
- **API 路由目录：** `src/app/api/books/`
- **核心依赖：**
  - `src/services/book.service.ts` - 书籍 CRUD 服务
  - `src/services/chapter.service.ts` - 章节服务
  - `src/services/outline.service.ts` - 大纲生成服务
  - `src/services/chapter-writing.service.ts` - 章节写作服务
  - `src/services/interaction.service.ts` - 互动服务（收藏、点赞等）
- **鉴权机制：** 基于 Cookie 的 JWT Token

## 核心功能

### 书籍列表
- **实现位置：** `src/app/api/books/route.ts:29`
- **设计说明：** 支持分页筛选，按 zoneStyle、status 过滤

### 书籍详情
- **实现位置：** `src/app/api/books/[id]/route.ts`
- **设计说明：** 获取书籍详细信息及大纲

### 创建书籍
- **实现位置：** `src/app/api/books/route.ts:74`
- **设计说明：** 创建新书籍，支持指定赛季

### 章节列表
- **实现位置：** `src/app/api/books/[id]/chapters/route.ts`
- **设计说明：** 获取书籍下所有章节

### 章节详情
- **实现位置：** `src/app/api/books/[id]/chapters/[num]/route.ts`
- **设计说明：** 获取指定章节内容和统计

### 大纲生成
- **实现位置：** `src/app/api/books/[id]/generate-outline/route.ts`
- **设计说明：** 调用 LLM 生成书籍大纲

### 章节生成
- **实现位置：** `src/app/api/books/[id]/generate-chapter/route.ts`
- **设计说明：** 调用 LLM 生成章节内容

### 收藏功能
- **实现位置：** `src/app/api/books/[id]/favorite/route.ts`
- **设计说明：** 收藏/取消收藏书籍

### 点赞功能
- **实现位置：** `src/app/api/books/[id]/chapters/[num]/like/route.ts`
- **设计说明：** 点赞/取消点赞章节

### 催更功能
- **实现位置：** `src/app/api/books/[id]/poke/route.ts`
- **设计说明：** 催更书籍作者

### 章节追完
- **实现位置：** `src/app/api/books/[id]/catch-up/route.ts`
- **设计说明：** 自动生成缺失章节

### 参加赛季
- **实现位置：** `src/app/api/books/join-season/route.ts`
- **设计说明：** 书籍报名参加赛季

### 礼物打赏
- **实现位置：** `src/app/api/books/[id]/gift/route.ts`
- **设计说明：** 送礼物增加书籍热度

## 数据库关联
- **书籍表：** `Book` - 书籍基本信息和统计
- **章节表：** `Chapter` - 书籍下的章节
- **用户表：** `User` - 书籍作者
- **赛季表：** `Season` - 参与的赛季
- **大纲版本表：** `BookOutlineVersion` - 大纲历史版本

## 接口文档
详细接口参数和返回值见自动生成的 API 文档
