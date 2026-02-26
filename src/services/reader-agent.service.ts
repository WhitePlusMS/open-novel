/**
 * Reader Agent 服务
 *
 * 在阅读窗口期调度 AI 读者阅读书籍并发表评论
 * 优化策略：
 * - 只对排名前 10 的书籍进行 AI 评论
 * - 每个章节随机选择 3-4 个 Agent 进行评论
 * - 根据每个 Agent 的 ReaderConfig 生成个性化提示词
 */

import { prisma } from '@/lib/prisma';
import { buildReaderSystemPrompt, buildReaderActionControl } from '@/lib/secondme/prompts';
import { testModeSendChat, getUserTokenById } from '@/lib/secondme/client';
import { ReaderConfig } from '@/services/user.service';
import { scoreService } from '@/services/score.service';
import { wsEvents } from '@/lib/websocket/events';
import { parseLLMJsonWithRetry } from '@/lib/utils/llm-parser';
import { interactionService } from './interaction.service';

// 评论反馈数据结构
interface ReaderFeedback {
  overall_rating: number;      // 综合评分 (1-10)
  praise: string;              // 赞扬的点
  critique: string;            // 批评的点
}

interface PreparedReaderComment {
  // Agent 基本信息
  agentUserId: string;
  agentNickname: string;
  readerConfig: ReaderConfig;
  // 章节与书籍信息
  chapterId: string;
  bookId: string;
  chapterNumber: number;
  chapterTitle: string;
  chapterContent: string;
  bookTitle: string;
  authorName: string;
  authorId: string;
  // LLM 调用上下文
  agentToken: string;
  systemPrompt: string;
  message: string;
}

interface ReaderDispatchSnapshot {
  chapterId: string;
  chapterNumber: number;
  chapterTitle: string;
  chapterContent: string;
  bookId: string;
  bookTitle: string;
  authorId: string;
  authorName: string;
}

export class ReaderAgentService {
  // 每个章节随机选择的 Agent 数量
  private readonly AGENTS_PER_CHAPTER = 3;
  // 只对排名前 N 的书籍进行 AI 评论
  private readonly TOP_BOOKS_COUNT = 10;

  // DB 并发：控制读写库并发，防止连接池耗尽
  private getDbConcurrency(): number {
    const raw = Number(process.env.DB_CONCURRENCY || process.env.TASK_CONCURRENCY);
    const fallback = 3;
    if (Number.isFinite(raw) && raw > 0) return Math.min(3, Math.floor(raw));
    return fallback;
  }

  // LLM 并发：控制大模型请求并行量
  private getLlmConcurrency(): number {
    const raw = Number(process.env.LLM_CONCURRENCY || process.env.AI_CONCURRENCY);
    const fallback = process.env.NODE_ENV === 'production' ? 4 : 6;
    if (Number.isFinite(raw) && raw > 0) return Math.floor(raw);
    return fallback;
  }

  // 通用并发执行器：用固定并发跑队列任务
  private async runWithConcurrency<T>(
    items: T[],
    limit: number,
    handler: (item: T) => Promise<void>
  ): Promise<void> {
    if (items.length === 0) return;
    const concurrency = Math.max(1, Math.min(limit, items.length));
    let index = 0;
    const workers = Array.from({ length: concurrency }, async () => {
      while (true) {
        const current = index;
        index += 1;
        if (current >= items.length) break;
        await handler(items[current]);
      }
    });
    await Promise.all(workers);
  }

  /**
   * 调度所有启用的 Reader Agents 阅读新发布的章节
   */
  async dispatchReaderAgents(chapterId: string, bookId: string): Promise<void> {
    const startTime = Date.now();
    console.log(`[ReaderAgent] 开始调度 AI 读者 - chapter: ${chapterId}, book: ${bookId}`);

    try {
      const dbConcurrency = this.getDbConcurrency();
      const llmConcurrency = this.getLlmConcurrency();
      console.log(`[ReaderAgent][Supabase][读] 读取章节与用户, 并发=${dbConcurrency}`);

      // 1. 获取章节内容（包含作者信息）
      const chapter = await prisma.chapter.findUnique({
        where: { id: chapterId },
        include: {
          book: {
            include: {
              author: { select: { id: true, nickname: true } },
              // score 已合并到 Book 表，使用 Book 的直接字段
            },
          },
        },
      });

      if (!chapter) {
        console.error(`[ReaderAgent] 章节不存在: ${chapterId}`);
        return;
      }

      if (!chapter.content) {
        console.log(`[ReaderAgent] 章节内容为空，跳过评论: ${chapterId}`);
        return;
      }

      // 2. 获取启用的 Reader Agents（启用了评论功能的用户）
      const readerAgents = await this.getEnabledReaderAgents();
      if (readerAgents.length === 0) {
        console.log('[ReaderAgent] 没有启用的 Reader Agents');
        return;
      }

      // 3. 获取书籍当前排名，决定是否进行 AI 评论
      const rank = await this.getBookRank(bookId);
      if (rank === null || rank > this.TOP_BOOKS_COUNT) {
        console.log(`[ReaderAgent] 书籍排名 ${rank}，超过前 ${this.TOP_BOOKS_COUNT} 名，跳过 AI 评论`);
        return;
      }

      // 4. 随机选择 AGENTS_PER_CHAPTER 个 Agent 进行评论
      const selectedAgents = this.selectRandomAgents(readerAgents, this.AGENTS_PER_CHAPTER);
      console.log(`[ReaderAgent] 选择了 ${selectedAgents.length} 个 AI 读者进行评论`);

      const snapshot: ReaderDispatchSnapshot = {
        chapterId: chapter.id,
        chapterNumber: chapter.chapterNumber,
        chapterTitle: chapter.title,
        chapterContent: chapter.content,
        bookId: chapter.bookId,
        bookTitle: chapter.book.title,
        authorId: chapter.book.author.id,
        authorName: chapter.book.author.nickname || '作家',
      };

      const selectedAgentIds = selectedAgents.map((agent) => agent.userId);
      const agentUsers = await prisma.user.findMany({
        where: { id: { in: selectedAgentIds } },
        select: { id: true, agentConfig: true },
      });
      const aiAgentIdSet = new Set(agentUsers.filter((user) => user.agentConfig).map((user) => user.id));

      const existingComments = await prisma.comment.findMany({
        where: {
          chapterId,
          userId: { in: selectedAgentIds },
          isHuman: false,
        },
        select: { userId: true },
      });
      const existingCommentAgentIds = new Set(existingComments.map((comment) => comment.userId));

      // 5. 三段式并发：准备(读库) -> LLM 生成 -> 写库
      const preparedJobs: PreparedReaderComment[] = [];

      // 5.1 读库准备阶段：检查重复评论、构建 prompt、获取 token
      console.log(`[ReaderAgent][Supabase][读] 准备阶段, 并发=${dbConcurrency}`);
      await this.runWithConcurrency(selectedAgents, dbConcurrency, async (agent) => {
        const prepared = await this.prepareReaderComment({
          agentUserId: agent.userId,
          agentNickname: agent.nickname,
          readerConfig: agent.readerConfig,
          snapshot,
          isAiAgent: aiAgentIdSet.has(agent.userId),
          hasExistingComment: existingCommentAgentIds.has(agent.userId),
        }).catch((error) => {
          console.error(`[ReaderAgent] Agent ${agent.nickname} 评论准备失败:`, error);
          return null;
        });
        if (prepared) {
          preparedJobs.push(prepared);
        }
      });

      // 5.2 LLM 生成阶段：并行生成评论反馈
      const generatedJobs: Array<{ prepared: PreparedReaderComment; feedback: ReaderFeedback }> = [];
      console.log(`[ReaderAgent][LLM] 生成阶段, 并发=${llmConcurrency}`);
      await this.runWithConcurrency(preparedJobs, llmConcurrency, async (prepared) => {
        const feedback = await this.generateReaderFeedback(prepared).catch((error) => {
          console.error(`[ReaderAgent] Agent ${prepared.agentNickname} 评论生成失败:`, error);
          return null;
        });
        if (feedback) {
          generatedJobs.push({ prepared, feedback });
        }
      });

      // 5.3 写库阶段：落库评论、更新统计、触发事件
      console.log(`[ReaderAgent][Supabase][写] 写入阶段, 并发=${dbConcurrency}`);
      await this.runWithConcurrency(generatedJobs, dbConcurrency, async (job) => {
        await this.persistReaderComment(job.prepared, job.feedback).catch((error) => {
          console.error(`[ReaderAgent] Agent ${job.prepared.agentNickname} 评论写入失败:`, error);
        });
      });

      const duration = Date.now() - startTime;
      console.log(`[ReaderAgent] 调度完成 - 耗时: ${duration}ms`);
    } catch (error) {
      console.error('[ReaderAgent] 调度失败:', error);
    }
  }

  async batchDispatchReaderAgents(entries: Array<{ chapterId: string; bookId: string; chapterNumber: number }>): Promise<void> {
    if (entries.length === 0) return;
    const dbConcurrency = this.getDbConcurrency();
    await this.runWithConcurrency(entries, dbConcurrency, async (entry) => {
      await this.dispatchReaderAgents(entry.chapterId, entry.bookId).catch((error) => {
        console.error(`[ReaderAgent] 章节 ${entry.chapterNumber} 调度失败:`, error);
      });
    });
  }

  /**
   * 获取所有启用了评论功能的 Reader Agents
   * 返回类型确保 readerConfig 不为 null
   */
  private async getEnabledReaderAgents(): Promise<Array<{
    userId: string;
    nickname: string;
    readerConfig: ReaderConfig;
  }>> {
    // 查询所有用户，然后在代码中过滤 readerConfig 不为 null 的
    const users = await prisma.user.findMany({
      select: {
        id: true,
        nickname: true,
        readerConfig: true,
      },
    });

    // 过滤出启用了评论功能且配置有效的用户
    const validAgents: Array<{
      userId: string;
      nickname: string;
      readerConfig: ReaderConfig;
    }> = [];

    for (const user of users) {
      if (user.readerConfig) {
        // JSONB 自动解析，直接使用类型断言
        const config = user.readerConfig as unknown as ReaderConfig;
        // 只返回启用了评论功能的用户
        if (config?.commentingBehavior?.enabled === true) {
          validAgents.push({
            userId: user.id,
            nickname: user.nickname,
            readerConfig: config,
          });
        }
      }
    }

    return validAgents;
  }

  /**
   * 获取书籍在当前赛季的排名
   * 直接按热度计算，替代依赖 leaderboard 表
   */
  private async getBookRank(bookId: string): Promise<number | null> {
    try {
      // 获取当前赛季
      const season = await prisma.season.findFirst({
        where: { status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' },
      });

      if (!season) {
        console.warn('[ReaderAgent] 没有进行中的赛季');
        return null;
      }

      // 获取该赛季所有书籍按热度排序 - 使用 Book 的 heatValue 字段
      const books = await prisma.book.findMany({
        where: { seasonId: season.id },
        // score 已合并到 Book 表，使用 Book 的直接字段
        orderBy: { heatValue: 'desc' },
      });

      // 查找书籍排名
      const rankIndex = books.findIndex((book) => book.id === bookId);
      return rankIndex === -1 ? null : rankIndex + 1;
    } catch (error) {
      console.error('[ReaderAgent] 获取书籍排名失败:', error);
      return null;
    }
  }

  /**
   * 随机选择指定数量的 Agent
   */
  private selectRandomAgents<T>(agents: T[], count: number): T[] {
    const shuffled = [...agents].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, agents.length));
  }

  private async prepareReaderComment(params: {
    agentUserId: string;
    agentNickname: string;
    readerConfig: ReaderConfig;
    snapshot: ReaderDispatchSnapshot;
    isAiAgent: boolean;
    hasExistingComment: boolean;
  }): Promise<PreparedReaderComment | null> {
    const { agentUserId, agentNickname, readerConfig, snapshot, isAiAgent, hasExistingComment } = params;
    // 作者本人不参与评论
    if (agentUserId === snapshot.authorId) {
      console.log(`[ReaderAgent] Agent ${agentNickname} 是作者本人，跳过评分`);
      return null;
    }

    // AI Agent 避免重复评论同一章节
    if (isAiAgent) {
      if (hasExistingComment) {
        console.log(`[ReaderAgent] Agent ${agentNickname} 已评论过第 ${snapshot.chapterNumber} 章，跳过`);
        return null;
      }
    }

    // 按评论概率随机决定是否发表评论
    if (Math.random() > readerConfig.commentingBehavior.commentProbability) {
      console.log(`[ReaderAgent] Agent ${agentNickname} 随机跳过了评论`);
      return null;
    }

    console.log(`[ReaderAgent] Agent ${agentNickname} 正在阅读《${snapshot.bookTitle}》第 ${snapshot.chapterNumber} 章...`);

    // 组装系统提示词与读者引导
    const systemPrompt = buildReaderSystemPrompt({
      readerName: agentNickname,
      readerPersonality: readerConfig.readerPersonality,
      preferences: {
        genres: readerConfig.readingPreferences.preferredGenres,
        style: undefined,
        minRating: readerConfig.readingPreferences.minRatingThreshold,
      },
    });

    const actionControl = buildReaderActionControl(readerConfig.readingPreferences.commentFocus);
    const message = `你正在阅读《${snapshot.bookTitle}》第 ${snapshot.chapterNumber} 章 "${snapshot.chapterTitle}"，作者：${snapshot.authorName}。

## 章节内容
${snapshot.chapterContent.slice(0, 4000)} ${snapshot.chapterContent.length > 4000 ? '...(内容截断)' : ''}

${actionControl}`;

    // 获取该 Agent 用户的 token
    const agentToken = await getUserTokenById(agentUserId);
    if (!agentToken) {
      console.error(`[ReaderAgent] 无法获取 Agent ${agentNickname} 的 Token，跳过评论`);
      return null;
    }

    return {
      agentUserId,
      agentNickname,
      readerConfig,
      chapterId: snapshot.chapterId,
      bookId: snapshot.bookId,
      chapterNumber: snapshot.chapterNumber,
      chapterTitle: snapshot.chapterTitle,
      chapterContent: snapshot.chapterContent,
      bookTitle: snapshot.bookTitle,
      authorName: snapshot.authorName,
      authorId: snapshot.authorId,
      agentToken,
      systemPrompt,
      message,
    };
  }

  private async generateReaderFeedback(prepared: PreparedReaderComment): Promise<ReaderFeedback | null> {
    // LLM 生成评论（带重试）
    const feedback = await parseLLMJsonWithRetry<ReaderFeedback>(
      () => testModeSendChat(prepared.message, prepared.systemPrompt, 'opennovel-reader', prepared.agentToken),
      {
        taskId: `ReaderAgent-${prepared.agentNickname}-${prepared.bookTitle}-ch${prepared.chapterNumber}`,
        maxRetries: 3,
      }
    );

    const rating = feedback.overall_rating;
    const ratingThreshold = 6;
    // 低分评论不触发落库
    if (rating < ratingThreshold) {
      console.log(`[ReaderAgent] Agent ${prepared.agentNickname} 评分 ${rating} 低于阈值 ${ratingThreshold}，跳过评论`);
      return null;
    }

    return feedback;
  }

  private async persistReaderComment(prepared: PreparedReaderComment, feedback: ReaderFeedback): Promise<void> {
    const content = `${feedback.praise || ''} ${feedback.critique || ''}`.trim();
    if (!content) {
      console.log(`[ReaderAgent] Agent ${prepared.agentNickname} 评论内容为空，跳过落库`);
      return;
    }
    const [comment] = await prisma.$transaction([
      prisma.comment.create({
        data: {
          bookId: prepared.bookId,
          chapterId: prepared.chapterId,
          userId: prepared.agentUserId,
          isHuman: false,
          aiRole: 'Reader',
          rating: feedback.overall_rating,
          content,
          praise: feedback.praise || null,
          critique: feedback.critique || null,
        },
        include: {
          user: { select: { id: true, nickname: true, avatar: true } },
        },
      }),
      prisma.chapter.update({
        where: { id: prepared.chapterId },
        data: { commentCount: { increment: 1 } },
      }),
    ]);

    console.log(`[ReaderAgent] Agent ${prepared.agentNickname} 评论完成 - 评分: ${feedback.overall_rating}/10`);

    // 通知前端有新评论
    wsEvents.newComment(prepared.bookId, {
      id: comment.id,
      content,
      isHuman: false,
      user: {
        nickname: prepared.agentNickname,
      },
      createdAt: comment.createdAt.toISOString(),
    });

    // 重新计算热度并推送更新
    try {
      const scoreResult = await scoreService.calculateFullScore(prepared.bookId);
      console.log(`[ReaderAgent] 热度已更新 - book: ${prepared.bookId}, heatValue: ${scoreResult.heatValue}, avgRating: ${feedback.overall_rating}/10`);
      wsEvents.heatUpdate(prepared.bookId, scoreResult.heatValue);
    } catch (error) {
      console.error(`[ReaderAgent] 热度计算失败:`, error);
    }

    // 发放读者奖励并自动打赏作者
    await this.awardInkForComment({
      agentUserId: prepared.agentUserId,
      agentNickname: prepared.agentNickname,
      readerConfig: prepared.readerConfig,
      bookId: prepared.bookId,
      authorId: prepared.authorId,
      rating: feedback.overall_rating,
    });
  }

  /**
   * 根据评价质量发放 Ink 奖励给 Reader Agent，并自动打赏给作者
   *
   * 奖励规则：
   * - 评分 8-10 分：+5 Ink 奖励，好评
   * - 评分 5-7 分：+2 Ink 奖励，普通
   * - 评分 1-4 分：+1 Ink 奖励，参与奖
   *
   * 打赏规则：
   * - 评分 >= 8 且 giftEnabled 开启时，自动打赏 2 Ink 给作者
   */
  private async awardInkForComment(params: {
    agentUserId: string;
    agentNickname: string;
    readerConfig: ReaderConfig;
    bookId: string;
    authorId: string;
    rating: number;
  }): Promise<void> {
    const { agentUserId, agentNickname, readerConfig, bookId, rating } = params;

    // 计算奖励 Ink
    let rewardInk = 1;
    let rewardType = '参与奖';
    if (rating >= 8) {
      rewardInk = 5;
      rewardType = '好评奖';
    } else if (rating >= 5) {
      rewardInk = 2;
      rewardType = '普通奖';
    }

    // 奖励给 Reader Agent
    await prisma.user.update({
      where: { id: agentUserId },
      data: { totalInk: { increment: rewardInk } },
    });
    console.log(`[ReaderAgent] Agent ${agentNickname} 获得 ${rewardInk} Ink（${rewardType}）`);

    // 检查是否开启打赏功能且评分足够高
    const giftEnabled = readerConfig.interactionBehavior?.giftEnabled ?? false;
    if (giftEnabled && rating >= 8) {
      try {
        // 自动打赏 2 Ink 给作者
        await interactionService.gift(bookId, agentUserId, 2);
        console.log(`[ReaderAgent] Agent ${agentNickname} 自动打赏 2 Ink 给作者（评分 ${rating}/10）`);
      } catch (error) {
        // 打赏失败（可能是余额不足），不影响主流程
        console.error(`[ReaderAgent] Agent ${agentNickname} 自动打赏失败:`, error);
      }
    }
  }

}

export const readerAgentService = new ReaderAgentService();
