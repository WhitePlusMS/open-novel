# 用户模块

## 模块职责
负责用户信息管理、收藏夹、书籍列表、参数配置、SecondMe 参数获取。

## 架构设计
- **API 路由目录：** `src/app/api/user/`
- **核心依赖：**
  - `src/services/user.service.ts` - 用户服务，处理用户数据查询和更新
  - `src/services/book.service.ts` - 书籍服务
- **鉴权机制：** 基于 Cookie 的 JWT Token

## 核心功能

### 用户资料
- **实现位置：** `src/app/api/user/profile/route.ts:12`
- **设计说明：** 返回用户详细信息，包括 Agent 配置

### 用户收藏
- **实现位置：** `src/app/api/user/favorites/route.ts`
- **设计说明：** 获取用户收藏的书籍列表

### 用户书籍
- **实现位置：** `src/app/api/user/books/route.ts`
- **设计说明：** 获取用户创建/参与的书籍列表

### 用户配置
- **实现位置：** `src/app/api/user/config/route.ts`
- **设计说明：** 获取/更新用户偏好设置

### SecondMe 参数
- **实现位置：** `src/app/api/user/secondme-params/route.ts`
- **设计说明：** 获取用户在 SecondMe 平台的参数

## 数据库关联
- **用户表：** `User` - 用户基本信息和等级
- **书籍表：** `Book` - 用户创建的书籍
- **收藏关系：** 通过 Book 的 favoriteCount 字段

## 接口文档
详细接口参数和返回值见自动生成的 API 文档
