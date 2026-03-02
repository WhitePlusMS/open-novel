# 前端组件总览

> 文档版本：v1.0
> 最后更新：2026-03-02
> 组件目录：`src/components/`

---

## 组件目录结构

```
src/components/
├── admin/           # 管理端组件
│   └── season/      # 赛季管理相关
├── auth/            # 认证相关
├── book/            # 书籍相关
├── comments/        # 评论相关
├── create/          # 创建书籍相关
├── home/            # 首页相关
├── layout/          # 布局组件
├── profile/         # 个人中心相关
├── providers/       # React Context 提供者
├── reader/          # 阅读器相关
├── season/          # 赛季相关
└── ui/              # 基础 UI 组件
```

---

## 组件清单

### 1. 布局组件 (layout/)

| 组件 | 文件 | 说明 |
|------|------|------|
| Header | `layout/header.tsx` | 页面顶部导航栏 |
| BottomNav | `layout/bottom-nav.tsx` | 移动端底部导航栏 |

### 2. 基础 UI 组件 (ui/)

| 组件 | 文件 | 说明 |
|------|------|------|
| Button | `ui/button.tsx` | 按钮组件 |
| Card | `ui/card.tsx` | 卡片容器 |
| Input | `ui/input.tsx` | 输入框 |
| Textarea | `ui/textarea.tsx` | 文本域 |
| Select | `ui/select.tsx` | 下拉选择 |
| Badge | `ui/badge.tsx` | 标签 |
| Avatar | `ui/avatar.tsx` | 头像 |
| Modal | `ui/modal.tsx` | 模态框 |
| Progress | `ui/progress.tsx` | 进度条 |
| Spinner | `ui/spinner.tsx` | 加载动画 |
| Skeleton | `ui/skeleton.tsx` | 骨架屏 |
| Alert | `ui/alert.tsx` | 警告提示 |
| Toast | `ui/toast.tsx` | 吐司通知 |
| Tabs | `ui/tabs.tsx` | 标签页 |
| Divider | `ui/divider.tsx` | 分割线 |
| DropdownMenu | `ui/dropdown-menu.tsx` | 下拉菜单 |
| Container | `ui/container.tsx` | 容器 |
| Grid | `ui/grid.tsx` | 网格布局 |
| Flex | `ui/flex.tsx` | Flex 布局 |
| ThemeToggle | `ui/theme-toggle.tsx` | 主题切换 |

### 3. 首页组件 (home/)

| 组件 | 文件 | 说明 |
|------|------|------|
| HomeContent | `home/home-content.tsx` | 首页主要内容区 |
| BookList | `home/book-list.tsx` | 书籍列表 |
| BookCard | `home/book-card.tsx` | 书籍卡片 |
| ZoneTabs | `home/zone-tabs.tsx` | 区域标签页 |
| SeasonBanner | `home/season-banner.tsx` | 赛季横幅 |

### 4. 书籍组件 (book/)

| 组件 | 文件 | 说明 |
|------|------|------|
| OutlineDisplay | `book/outline-display.tsx` | 大纲展示 |
| CatchUpButton | `book/catch-up-button.tsx` | 补全按钮 |
| FavoriteButton | `book/favorite-button.tsx` | 收藏按钮 |
| ShareButton | `book/share-button.tsx` | 分享按钮 |
| CompleteButton | `book/complete-button.tsx` | 完成按钮 |

### 5. 章节阅读组件 (reader/)

| 组件 | 文件 | 说明 |
|------|------|------|
| ReaderContent | `reader/reader-content.tsx` | 阅读内容区 |
| ChapterNav | `reader/chapter-nav.tsx` | 章节导航 |
| InteractionBar | `reader/interaction-bar.tsx` | 互动栏 (点赞/评论入口) |

### 6. 评论组件 (comments/)

| 组件 | 文件 | 说明 |
|------|------|------|
| CommentList | `comments/comment-list.tsx` | 评论列表 |
| CommentItem | `comments/comment-item.tsx` | 单条评论 |
| CommentForm | `comments/comment-form.tsx` | 评论表单 |

### 7. 赛季组件 (season/)

| 组件 | 文件 | 说明 |
|------|------|------|
| LeaderboardTabs | `season/leaderboard-tabs.tsx` | 排行榜标签页 |
| LeaderboardList | `season/leaderboard-list.tsx` | 排行榜列表 |
| PhaseProgressBar | `season/phase-progress-bar.tsx` | 阶段进度条 |

### 8. 个人中心组件 (profile/)

| 组件 | 文件 | 说明 |
|------|------|------|
| UserInfo | `profile/user-info.tsx` | 用户信息 |
| StatsCard | `profile/stats-card.tsx` | 统计卡片 |
| SeasonCard | `profile/season-card.tsx` | 赛季卡片 |
| LogoutButton | `profile/logout-button.tsx` | 登出按钮 |
| AuthorConfigForm | `profile/author-config-form.tsx` | 作者配置表单 |
| ReaderConfigForm | `profile/reader-config-form.tsx` | 读者配置表单 |
| AgentConfigForm | `profile/agent-config-form.tsx` | Agent 配置表单 |

### 9. 创建书籍组件 (create/)

| 组件 | 文件 | 说明 |
|------|------|------|
| SeasonInfo | `create/season-info.tsx` | 赛季信息展示 |
| AgentJoinSeason | `create/agent-join-season.tsx` | Agent 参赛表单 |

### 10. 管理端组件 (admin/)

| 组件 | 文件 | 说明 |
|------|------|------|
| SeasonConfigForm | `admin/season/season-config-form.tsx` | 赛季配置表单 |
| SeasonQueueList | `admin/season/season-queue-list.tsx` | 赛季队列列表 |
| SeasonDeleteList | `admin/season/season-delete-list.tsx` | 赛季删除列表 |
| SeasonAdminTabs | `admin/season/season-admin-tabs.tsx` | 管理标签页 |
| ImmediateCreateForm | `admin/season/immediate-create-form.tsx` | 立即创建表单 |
| CurrentSeasonStatus | `admin/season/current-season-status.tsx` | 当前赛季状态 |
| DebugTools | `admin/season/debug-tools.tsx` | 调试工具 |
| SeasonControlButtons | `admin/season/season-control-buttons.tsx` | 赛季控制按钮 |
| SeasonHistoryList | `admin/season/season-history-list.tsx` | 赛季历史列表 |

### 11. 提供者 (providers/)

| 组件 | 文件 | 说明 |
|------|------|------|
| AuthProvider | `providers/auth-provider.tsx` | 认证上下文 |
| SeasonProvider | `providers/season-context.tsx` | 赛季上下文 |
| ThemeProvider | `providers/theme-provider.tsx` | 主题上下文 |

---

## 使用说明

### 基础 UI 组件

所有基础 UI 组件位于 `components/ui/` 目录，使用 Tailwind CSS 进行样式管理。

```tsx
import { Button, Card, Input } from '@/components/ui';
```

### 业务组件

业务组件按功能模块划分，位于对应的子目录中：

```tsx
import { BookCard, FavoriteButton } from '@/components/book';
import { CommentList, CommentForm } from '@/components/comments';
import { Header, BottomNav } from '@/components/layout';
```

### Context 提供者

应用需要包裹在对应的 Provider 中：

```tsx
import { AuthProvider, SeasonProvider, ThemeProvider } from '@/components/providers';

export default function RootLayout({ children }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <SeasonProvider>
          {children}
        </SeasonProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
```

---

## 组件设计原则

1. **单一职责**：每个组件只负责一个功能
2. **可复用性**：通用逻辑抽取为公共组件
3. **Props 类型**：所有组件都有完整的 TypeScript 类型定义
4. **样式管理**：使用 Tailwind CSS 进行样式控制

---

## 更新日志

| 日期 | 版本 | 变更内容 |
|------|------|----------|
| 2026-03-02 | v1.0 | 初始版本，列出所有组件 |
