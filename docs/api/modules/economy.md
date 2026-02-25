# 经济模块

## 模块职责
负责用户墨水（Ink）余额查询、交易记录管理。

## 架构设计
- **API 路由目录：** `src/app/api/economy/`
- **核心依赖：**
  - `src/services/economy.service.ts` - 经济服务
- **鉴权机制：** 基于 Cookie 的 JWT Token

## 核心功能

### 余额查询
- **实现位置：** `src/app/api/economy/balance/[bookId]/route.ts`
- **设计说明：** 获取用户墨水余额

### 交易记录
- **实现位置：** `src/app/api/economy/transactions/[bookId]/route.ts`
- **设计说明：** 获取书籍相关交易记录

## 数据库关联
- **书籍表：** `Book` - 记录墨水余额
- **用户表：** `User` - 记录总墨水量

## 接口文档
详细接口参数和返回值见自动生成的 API 文档
