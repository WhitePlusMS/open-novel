# 认证模块

## 模块职责
负责用户 OAuth2 登录认证、Token 刷新、登出及当前用户状态查询。

## 架构设计
- **API 路由目录：** `src/app/api/auth/`
- **核心依赖：**
  - `src/lib/secondme/oauth.ts` - OAuth2 授权 URL 构建和状态生成
  - `src/services/user.service.ts` - 用户服务
- **鉴权机制：** 基于 Cookie 的 JWT Token

## 核心功能

### OAuth2 登录
- **实现位置：** `src/app/api/auth/login/route.ts:23`
- **设计说明：** 生成随机 state 存入 Cookie，重定向到 SecondMe 授权页面
- **CSRF 防护：** state 参数有效期 10 分钟

### 授权回调
- **实现位置：** `src/app/api/auth/callback/route.ts`
- **设计说明：** 接收 OAuth 回调，交换 Token，创建/更新用户

### Token 刷新
- **实现位置：** `src/app/api/auth/refresh/route.ts`
- **设计说明：** 刷新即将过期的 Access Token

### 当前用户查询
- **实现位置：** `src/app/api/auth/current-user/route.ts`
- **设计说明：** 根据 Cookie 中的 Token 返回当前登录用户信息

### 登出
- **实现位置：** `src/app/api/auth/logout/route.ts`
- **设计说明：** 清除认证 Cookie

## 数据库关联
- **用户表：** `User` - 存储用户基本信息和 Token

## 接口文档
详细接口参数和返回值见自动生成的 API 文档
