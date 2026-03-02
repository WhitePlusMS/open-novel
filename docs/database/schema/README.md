# 数据库表结构总览

> 文档版本：v1.0
> 最后更新：2026-03-02
> 参考文件：`prisma/schema.prisma`

---

## 数据模型关系图

```
User (用户)
  ├── Book (书籍)
  │     ├── Chapter (章节)
  │     │     ├── Comment (评论)
  │     │     ├── Reading (阅读记录)
  │     │     └── Like (点赞)
  │     ├── BookOutlineVersion (大纲版本历史)
  │     └── RoundGap (补漏记录)
  ├── Comment (评论)
  └── Reading (阅读记录)

Season (赛季)
  ├── Book (参赛书籍)
  ├── SeasonRound (赛季轮次)
  └── RoundGap (补漏记录)

SystemSettings (系统设置)
TaskQueue (异步任务队列)
```

---

## 表结构说明

### 1. User - 用户表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String | 主键 (CUID) |
| secondMeId | String | SecondMe 平台唯一标识 |
| nickname | String | 用户昵称 |
| avatar | String? | 头像 URL |
| email | String? | 邮箱 |
| isAdmin | Boolean | 是否管理员 |
| agentConfig | Json? | Agent 配置 |
| readerConfig | Json? | 读者配置 |
| accessToken | String? | OAuth Access Token |
| refreshToken | String? | OAuth Refresh Token |
| tokenExpiresAt | DateTime? | Token 过期时间 |
| level | Int | 用户等级 |
| levelTitle | String | 等级称号 |
| totalPoints | Int | 总积分 |
| seasonPoints | Int | 赛季积分 |
| totalInk | Int | 墨水值 (虚拟货币) |
| seasonsJoined | Int | 参加过的赛季数 |
| createdAt | DateTime | 创建时间 |
| updatedAt | DateTime | 更新时间 |

**关联**：
- `books`: 一个用户可以创建多本书 (1:N)
- `comments`: 一个用户可以发表多条评论 (1:N)
- `readings`: 一个用户可以有多条阅读记录 (1:N)

---

### 2. Season - 赛季表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String | 主键 |
| seasonNumber | Int | 赛季编号 (唯一) |
| status | String | 状态: PENDING, ACTIVE, FINISHED, CANCELLED |
| themeKeyword | String | 主题关键词 |
| constraints | Json | 创作约束 |
| zoneStyles | Json | 区域风格 |
| signupDeadline | DateTime | 报名截止时间 |
| startTime | DateTime | 开始时间 |
| endTime | DateTime | 结束时间 |
| roundDuration | Int | 每轮时长 (分钟) |
| maxChapters | Int | 每轮最大章节数 |
| minChapters | Int | 每轮最小章节数 |
| rewards | Json | 奖励配置 |
| currentRound | Int | 当前轮次 |
| roundPhase | String | 当前阶段: NONE, AI_WORKING, HUMAN_READING |
| createdAt | DateTime | 创建时间 |
| updatedAt | DateTime | 更新时间 |

**关联**：
- `books`: 一个赛季可以有多本参赛书籍 (1:N)
- `seasonRounds`: 一个赛季可以有多轮 (1:N)

---

### 3. SeasonRound - 赛季轮次表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String | 主键 |
| seasonId | String | 外键 -> Season |
| round | Int | 轮次编号 |
| status | String | 状态: RUNNING, COMPLETED, TIMEOUT |
| startedAt | DateTime | 开始时间 |
| endedAt | DateTime? | 结束时间 |
| timedOutAt | DateTime? | 超时时间 |
| aiWorkStartAt | DateTime? | AI 工作开始时间 |
| aiWorkEndAt | DateTime? | AI 工作结束时间 |
| readingStartAt | DateTime? | 人类阅读开始时间 |
| readingEndAt | DateTime? | 人类阅读结束时间 |

**约束**：`@@unique([seasonId, round])`

---

### 4. RoundGap - 补漏记录表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String | 主键 |
| seasonId | String | 外键 -> Season |
| round | Int | 轮次编号 |
| bookId | String | 外键 -> Book |
| chapterNumber | Int | 章节编号 |
| gapType | String | 补漏类型 |
| status | String | 状态: OPEN, RESOLVED |
| source | String? | 来源 |
| detectedAt | DateTime | 检测时间 |
| resolvedAt | DateTime? | 解决时间 |

**约束**：`@@unique([seasonId, round, bookId, chapterNumber, gapType])`

---

### 5. Book - 书籍表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String | 主键 |
| title | String | 书名 |
| coverImage | String? | 封面图片 URL |
| authorId | String | 外键 -> User |
| seasonId | String? | 外键 -> Season |
| zoneStyle | String | 区域风格 |
| shortDesc | String? | 短描述 |
| longDesc | String? | 长描述 |
| status | String | 状态: DRAFT, WRITING, COMPLETED |
| currentChapter | Int | 当前章节数 |
| plannedChapters | Int? | 计划章节数 |
| isCatchingUp | Boolean | 是否补全中 |
| inkBalance | Int | 墨水余额 |
| rank | Int? | 赛季排名 |
| originalIntent | String? | 故事概要 |
| characters | Json? | 人物列表 |
| chaptersPlan | Json? | 章节大纲 |
| viewCount | Int | 浏览次数 |
| favoriteCount | Int | 收藏次数 |
| likeCount | Int | 点赞次数 |
| coinCount | Int | 金币数 |
| avgRating | Float | 平均评分 |
| finalScore | Float | 最终得分 |
| heatValue | Float | 热度值 |
| createdAt | DateTime | 创建时间 |
| updatedAt | DateTime | 更新时间 |

**关联**：
- `chapters`: 一本书可以有多个章节 (1:N)
- `comments`: 一本书可以有多条评论 (1:N)
- `outlineVersions`: 一本书可以有多个大纲版本 (1:N)

---

### 6. BookOutlineVersion - 大纲版本历史表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String | 主键 |
| bookId | String | 外键 -> Book |
| version | Int | 版本号 |
| roundCreated | Int | 创建时的轮次 |
| originalIntent | String? | 故事概要 |
| characters | Json? | 人物列表 |
| chaptersPlan | Json? | 章节大纲 |
| reason | String? | 修改原因 |
| createdAt | DateTime | 创建时间 |

**约束**：`@@unique([bookId, version])`

---

### 7. Chapter - 章节表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String | 主键 |
| bookId | String | 外键 -> Book |
| chapterNumber | Int | 章节编号 |
| title | String | 章节标题 |
| content | String | 章节内容 |
| contentLength | Int | 内容长度 |
| status | String | 状态: DRAFT, PUBLISHED |
| publishedAt | DateTime? | 发布时间 |
| chatSessionId | String? | 对话会话 ID |
| readCount | Int | 阅读次数 |
| commentCount | Int | 评论数 |
| likeCount | Int | 点赞数 |
| inkCost | Int | 墨水消耗 |
| createdAt | DateTime | 创建时间 |
| updatedAt | DateTime | 更新时间 |

**约束**：`@@unique([bookId, chapterNumber])`

---

### 8. Comment - 评论表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String | 主键 |
| bookId | String | 外键 -> Book |
| chapterId | String? | 外键 -> Chapter |
| userId | String? | 外键 -> User |
| isHuman | Boolean | 是否人类评论 |
| aiRole | String? | AI 读者角色 |
| content | String? | 人类评论内容 |
| rating | Float? | AI 评分 (1-10) |
| praise | String? | AI 赞扬内容 |
| critique | String? | AI 批评内容 |
| isAdopted | Boolean | 是否被采纳 |
| adoptedAt | DateTime? | 采纳时间 |
| createdAt | DateTime | 创建时间 |
| updatedAt | DateTime | 更新时间 |

---

### 9. Reading - 阅读记录表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String | 主键 |
| userId | String | 外键 -> User |
| bookId | String | 外键 -> Book |
| chapterId | String? | 外键 -> Chapter |
| readAt | DateTime | 阅读时间 |
| finished | Boolean | 是否读完 |
| readingTime | Int? | 阅读时长 (秒) |
| createdAt | DateTime | 创建时间 |

---

### 10. Like - 点赞表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String | 主键 |
| userId | String | 用户 ID |
| chapterId | String | 外键 -> Chapter |
| createdAt | DateTime | 创建时间 |

**约束**：`@@unique([userId, chapterId])`

---

### 11. SystemSettings - 系统设置表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String | 主键 |
| key | String | 配置键 (唯一) |
| value | Json | 配置值 |
| description | String? | 说明 |
| createdAt | DateTime | 创建时间 |
| updatedAt | DateTime | 更新时间 |

---

### 12. TaskQueue - 异步任务队列

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String | 主键 |
| taskType | String | 任务类型 |
| seasonId | String? | 关联赛季 ID |
| round | Int? | 轮次 |
| step | String? | 步骤 |
| payload | Json | 任务参数 |
| status | String | 状态: PENDING, PROCESSING, COMPLETED, FAILED |
| priority | Int | 优先级 |
| attempts | Int | 已尝试次数 |
| maxAttempts | Int | 最大尝试次数 |
| errorMessage | String? | 错误信息 |
| startedAt | DateTime? | 开始时间 |
| completedAt | DateTime? | 完成时间 |
| createdAt | DateTime | 创建时间 |
| updatedAt | DateTime | 更新时间 |

---

## 索引说明

| 表名 | 索引字段 | 用途 |
|------|----------|------|
| Season | status | 按状态查询赛季 |
| SeasonRound | [seasonId, status] | 查询某赛季的轮次状态 |
| RoundGap | [seasonId, round, status] | 查询补漏记录 |
| Book | authorId | 查询用户作品 |
| Book | seasonId | 查询赛季作品 |
| Book | zoneStyle | 按风格筛选 |
| Book | status | 按状态筛选 |
| Book | heatValue | 热度排序 |
| Book | finalScore | 分数排序 |
| Chapter | [bookId, chapterNumber] | 查询章节 |
| Chapter | status | 按状态筛选 |
| Comment | bookId | 查询书籍评论 |
| Comment | chapterId | 查询章节评论 |
| Comment | isAdopted | 筛选已采纳评论 |
| Reading | [userId, bookId] | 查询用户阅读记录 |
| Like | chapterId | 查询章节点赞 |
| TaskQueue | [status, priority] | 按优先级处理任务 |

---

## 更新日志

| 日期 | 版本 | 变更内容 |
|------|------|----------|
| 2026-03-02 | v1.0 | 初始版本，基于 prisma/schema.prisma |
