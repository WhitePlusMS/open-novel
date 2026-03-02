# 前端页面列表

> 文档版本：v1.0
> 最后更新：2026-03-02
> 页面目录：`src/app/`

---

## 页面目录结构

```
src/app/
├── (auth)/                 # 认证相关路由组
├── admin/                  # 管理端
│   ├── test/               # 测试页面
│   │   ├── chapter/
│   │   ├── join-decision/
│   │   ├── llm/
│   │   ├── outline/
│   │   ├── outline-optimize/
│   │   └── reader/
│   └── secondme-test/
├── api/                    # API 路由
├── book/                   # 书籍详情
│   └── [id]/
│       └── chapter/
├── create/                 # 创建书籍
├── favorites/              # 收藏页
├── profile/               # 个人中心
│   └── edit/
├── season/                # 赛季页面
│   └── [id]/
└── page.tsx               # 首页
```

---

## 页面清单

### 1. 首页

| 路由 | 文件 | 说明 |
|------|------|------|
| `/` | `page.tsx` | 首页，展示当前赛季信息和书籍列表 |

**主要功能**：
- 显示当前赛季横幅和状态
- 展示不同区域的书籍列表
- 快速导航到各功能模块

---

### 2. 认证相关

| 路由 | 文件 | 说明 |
|------|------|------|
| `/api/auth/login` | `api/auth/login/route.ts` | OAuth2 登录入口 |
| `/api/auth/callback` | `api/auth/callback/route.ts` | OAuth2 回调处理 |
| `/api/auth/logout` | `api/auth/logout/route.ts` | 登出 |
| `/api/auth/refresh` | `api/auth/refresh/route.ts` | Token 刷新 |
| `/api/auth/current-user` | `api/auth/current-user/route.ts` | 获取当前用户 |

---

### 3. 书籍模块

| 路由 | 文件 | 说明 |
|------|------|------|
| `/book/[id]` | `book/[id]/page.tsx` | 书籍详情页 |
| `/book/[id]/chapter/[num]` | `book/[id]/chapter/[num]/page.tsx` | 章节阅读页 |
| `/create` | `create/page.tsx` | 创建新书籍页 |

**API 路由**：
- `GET /api/books` - 获取书籍列表
- `POST /api/books` - 创建书籍
- `GET /api/books/[id]` - 获取书籍详情
- `PUT /api/books/[id]` - 更新书籍
- `DELETE /api/books/[id]` - 删除书籍
- `POST /api/books/[id]/outline` - 生成大纲
- `POST /api/books/[id]/generate-outline` - 生成大纲
- `POST /api/books/[id]/optimize-outline` - 优化大纲
- `POST /api/books/[id]/generate-chapter` - 生成章节
- `POST /api/books/[id]/catch-up` - 章节补全
- `GET /api/books/[id]/chapters` - 获取章节列表
- `GET /api/books/[id]/chapters/[num]` - 获取章节内容
- `POST /api/books/[id]/chapters/[num]` - 创建/更新章节
- `POST /api/books/[id]/chapters/[num]/like` - 点赞章节
- `GET /api/books/[id]/chapters/[num]/like/status` - 点赞状态
- `POST /api/books/[id]/favorite` - 收藏书籍
- `GET /api/books/[id]/favorite/status` - 收藏状态
- `POST /api/books/[id]/gift` - 送礼物
- `GET /api/books/[id]/status` - 获取书籍状态
- `GET /api/books/[id]/comments` - 获取评论列表
- `GET /api/books/[id]/comments-summary` - 评论摘要
- `GET /api/books/[id]/outline-versions` - 大纲版本历史
- `POST /api/books/join-season` - 参赛

---

### 4. 赛季模块

| 路由 | 文件 | 说明 |
|------|------|------|
| `/season` | `season/page.tsx` | 赛季列表页 |
| `/season/[id]` | `season/[id]/page.tsx` | 赛季详情页 |

**API 路由**：
- `GET /api/seasons/current` - 获取当前赛季
- `GET /api/seasons/status` - 获取赛季状态
- `GET /api/seasons/[id]` - 获取赛季详情
- `GET /api/seasons/[id]/leaderboard` - 获取排行榜

---

### 5. 用户模块

| 路由 | 文件 | 说明 |
|------|------|------|
| `/profile` | `profile/page.tsx` | 个人中心页 |
| `/profile/edit` | `profile/edit/page.tsx` | 编辑个人资料页 |
| `/favorites` | `favorites/page.tsx` | 收藏列表页 |

**API 路由**：
- `GET /api/user/profile` - 获取用户资料
- `PUT /api/user/profile` - 更新用户资料
- `GET /api/user/books` - 获取用户书籍
- `GET /api/user/favorites` - 获取收藏列表
- `GET /api/user/secondme-params` - 获取 SecondMe 参数
- `GET /api/user/config` - 获取用户配置

---

### 6. 评论模块

| 路由 | 文件 | 说明 |
|------|------|------|
| 评论 | 通过书籍页面访问 | 章节评论功能 |

**API 路由**：
- `POST /api/comments/[id]/adopt` - 采纳评论

---

### 7. 经济系统

**API 路由**：
- `GET /api/economy/balance/[bookId]` - 获取书籍墨水余额
- `GET /api/economy/transactions/[bookId]` - 获取交易记录

---

### 8. 排行榜

**API 路由**：
- `GET /api/leaderboard` - 获取排行榜

---

### 9. AI 功能

**API 路由**：
- `POST /api/ai/generate` - AI 生成接口

---

### 10. 任务队列

**API 路由**：
- `POST /api/tasks/season-auto-advance` - 赛季自动推进
- `POST /api/tasks/process-tasks` - 处理任务队列
- `POST /api/tasks/reader-agents` - 读者 Agent 任务

---

### 11. 管理端

| 路由 | 文件 | 说明 |
|------|------|------|
| `/admin` | `admin/page.tsx` | 管理端首页 |
| `/admin/test` | `admin/test/page.tsx` | 测试页面 |
| `/admin/test/chapter` | `admin/test/chapter/page.tsx` | 章节测试 |
| `/admin/test/join-decision` | `admin/test/join-decision/page.tsx` | 参赛决策测试 |
| `/admin/test/llm` | `admin/test/llm/page.tsx` | LLM 测试 |
| `/admin/test/outline` | `admin/test/outline/page.tsx` | 大纲测试 |
| `/admin/test/outline-optimize` | `admin/test/outline-optimize/page.tsx` | 大纲优化测试 |
| `/admin/test/reader` | `admin/test/reader/page.tsx` | 读者测试 |
| `/admin/secondme-test` | `admin/secondme-test/page.tsx` | SecondMe 测试 |

**管理端 API 路由**：
- 赛季管理 (`/api/admin/seasons/[id]`)
- 赛季队列 (`/api/admin/season-queue`)
- 测试接口 (`/api/admin/test/*`)

---

## 页面访问流程

```
首页 (/)
    ├── 登录 → OAuth2 授权
    ├── 创建书籍 → /create
    │       └── 参赛 → 赛季选择
    ├── 书籍列表 → 点击书籍
    │       └── /book/[id]
    │           └── 阅读章节 → /book/[id]/chapter/[num]
    ├── 赛季入口 → /season
    │       └── 赛季详情 → /season/[id]
    ├── 排行榜 → /leaderboard (通过首页标签)
    ├── 收藏 → /favorites
    └── 个人中心 → /profile
            └── 编辑资料 → /profile/edit
```

---

## 路由约定

1. **动态路由**：使用 `[param]` 语法，如 `[id]`, `[num]`
2. **API 路由**：所有 API 路由在 `app/api/` 下
3. **管理端**：`/admin` 下的页面需要管理员权限
4. **测试页面**：`/admin/test` 下的页面用于开发和调试

---

## 更新日志

| 日期 | 版本 | 变更内容 |
|------|------|----------|
| 2026-03-02 | v1.0 | 初始版本，列出所有页面 |
