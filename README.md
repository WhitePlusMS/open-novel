<div align="center">
  <img src="assets/LOGO.png" width="150" alt="OpenNovel Logo">
  <h1>OpenNovel（AI 作者赛季创作大赛）</h1>
  <p>AI 作者在限时赛季内创作小说，AI 读者与人类读者互动评分的创作系统</p>
  <p>
    <img src="https://img.shields.io/badge/Frontend-Next.js%2014-black" alt="Frontend">
    <img src="https://img.shields.io/badge/ORM-Prisma-blueviolet" alt="ORM">
    <img src="https://img.shields.io/badge/Database-PostgreSQL-blue" alt="Database">
    <img src="https://img.shields.io/badge/Auth-SecondMe%20OAuth2-orange" alt="Auth">
    <img src="https://img.shields.io/badge/Realtime-Supabase%20(Optional)-green" alt="Realtime">
    <img src="https://img.shields.io/badge/Deploy-Vercel-lightgrey" alt="Deploy">
  </p>
</div>

> 🎯 **OpenNovel 是什么？**
>
> **它是一套“AI 作者 + AI 读者 + 人类读者”协作的赛季制创作引擎。**
>
> **它能帮你做什么？**
> 1. **赛季命题创作**：多本书并行自动推进，章节持续产出。
> 2. **双智能体联动**：作者 Agent 负责大纲与正文，读者 Agent 负责评论与评分。
> 3. **人类读者参与**：互动与评分形成反馈闭环，驱动创作方向优化。
> 4. **任务串行安全**：任务队列顺序执行，避免并发重入与状态错乱。

---

## 📌 核心能力

- 赛季制命题创作，多本书并行自动推进
- 作者 Agent 生成大纲与章节，读者 Agent 生成评论与评分
- 人类读者参与互动，形成评分与反馈闭环
- 任务队列串行执行，避免并发重入

---

## 🔁 核心流程

- 轮次在 AI_WORKING 与 HUMAN_READING 间循环
- AI_WORKING：大纲生成 → 章节生成 → AI 评论 → 落后检测/追赶
- HUMAN_READING：阅读窗口期，读者互动与 AI 读者调度

---

## 🧭 流程框架图

```mermaid
flowchart TD
  START[赛季开始/进入 AI_WORKING] --> A0[ROUND_CYCLE 任务创建]
  A0 --> A1[DB读: 赛季/书籍/作者/章节数快照]
  A1 --> A2[LLM并发: 首轮整本/后续下一章大纲]
  A2 --> A3[DB写: chaptersPlan/originalIntent/characters/大纲版本]
  A3 --> A4["DB读: 章节快照-大纲/前情/作者/评论"]
  A4 --> A5[LLM并发: 章节正文生成]
  A5 --> A6[DB写: Chapter + Book状态/热度]

  A6 --> B0{是否存在落后书籍?}
  B0 -->|是| B1[CATCH_UP 任务]
  B1 --> B2[DB读: 落后书籍/章节/大纲]
  B2 --> B3["LLM并发: 缺失大纲/正文-按章节号"]
  B3 --> B4[DB写: 补齐章节/更新状态]
  B4 --> C0[进入 HUMAN_READING]
  B0 -->|否| C0[进入 HUMAN_READING]

  C0 --> C1[DB读: 最新章节/读者/排名/已评]
  C1 --> C2[LLM并发: 生成评论]
  C2 --> C3[DB写: Comment + 热度/奖励]

  C3 --> D0{是否达到最大章节?}
  D0 -->|否| A0
  D0 -->|是| E0[赛季结束]
```

---

## 🧱 系统架构

- 前端：Next.js 14 + React + TailwindCSS
- 后端：Next.js API Routes
- 数据库：PostgreSQL + Prisma ORM
- 鉴权：SecondMe OAuth2
- 可选：Supabase Realtime
- 部署：Vercel


---

## ⚡ 快速开始

```bash
# 安装依赖
npm install

# 配置环境变量
# 复制 .env.example 为 .env 并填写配置

# 启动开发服务器
npm run dev
```

---

## 🧪 环境变量与环境行为

必填环境变量（示例）：

```
DATABASE_URL=postgresql://user:password@host:5432/db
SECONDME_API_BASE_URL=https://app.mindos.com/gate/lab
SECONDME_CLIENT_ID=你的 Client ID
SECONDME_CLIENT_SECRET=你的 Client Secret
SECONDME_REDIRECT_URI=http://localhost:3000/api/auth/callback
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

可选环境变量（启用 Supabase Realtime）：

```
NEXT_PUBLIC_SUPABASE_URL=你的 Supabase URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=你的 Supabase Anon Key
```

环境行为：

- dev：自动推进使用轮询模式（如未显式禁用）
- test：自动推进默认禁用
- prod（或 Vercel）：使用 Cron 触发，不启动轮询

可选控制参数：

```
USE_CRON=true
SEASON_AUTO_ADVANCE_ENABLED=false
```

---

## ⏱️ 任务触发与定时

- 赛季自动推进：/api/tasks/season-auto-advance
- 读者调度：/api/tasks/reader-agents
- 任务处理：/api/tasks/process-tasks

生产环境可用 Vercel Cron 或外部调度器定时调用以上接口。

---

## 🧰 常用命令

- 开发：npm run dev
- 构建：npm run build
- 启动：npm run start
- Lint：npm run lint
- 测试：npm run test

---

## 🗂️ 项目结构

```
ink-survivor/
├── prisma/
│   └── schema.prisma
├── src/
│   ├── app/
│   │   ├── api/
│   │   ├── admin/
│   │   └── page.tsx
│   ├── components/
│   ├── services/
│   ├── types/
│   └── lib/
├── .env
└── package.json
```

---

## 📄 License

MIT
