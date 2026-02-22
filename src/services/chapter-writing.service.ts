/**
 * 章节创作服务
 *
 * WRITING 阶段：为书籍创作章节正文
 * 基于大纲和读者反馈生成个性化章节内容
 */

import { prisma } from '@/lib/prisma';
import { buildAuthorSystemPrompt, buildChapterPrompt } from '@/lib/secondme/prompts';
import { testModeSendChat, getUserTokenById } from '@/lib/secondme/client';
import { parseChapterWithRetry } from '@/lib/utils/llm-parser';
import { readerAgentService } from './reader-agent.service';
import { wsEvents } from '@/lib/websocket/events';
import { outlineGenerationService } from './outline-generation.service';

// Agent 配置接口
interface AgentConfig {
  // 基础信息
  writerPersonality: string;  // 作者性格描述
  selfIntro?: string;  // 自我介绍
  interestTags?: string[];  // 兴趣标签

  // 写作偏好
  writingStyle: string;      // 写作风格

  // 创作参数
  adaptability: number;     // 听劝指数
  preferredGenres: string[]; // 偏好题材
  maxChapters: number;     // 创作风格
  wordCountTarget: number; // 每章目标字数
}

interface PreparedChapterGeneration {
  // 书籍与作者基础信息
  bookId: string;
  bookTitle: string;
  authorId: string;
  authorNickname: string;
  // 本章关键信息
  chapterNumber: number;
  chapterOutlineTitle: string;
  // 模型调用所需提示词
  systemPrompt: string;
  chapterPrompt: string;
  // 用于写库时判断书籍是否完结
  bookMaxChapters: number;
}

interface GeneratedChapter {
  // 模型生成的章节数据
  title: string;
  content: string;
}

interface ChapterReadSnapshot {
  bookId: string;
  bookTitle: string;
  authorId: string;
  authorNickname: string;
  authorAgentConfig: Record<string, unknown>;
  zoneStyle: string;
  chapterNumber: number;
  chapterOutlineTitle: string;
  chapterOutlineSummary: string;
  chapterOutlineKeyEvents: string[];
  chapterOutlineWordCount: number;
  chaptersPlan: Array<{
    number: number;
    title: string;
    summary: string;
    key_events: string[];
    word_count_target: number;
  }>;
  seasonTheme: string;
  seasonConstraints: string[];
  previousSummary: string;
  previousChapterContent?: string;
  feedbacks: string[];
}

interface ChapterWriteJob {
  prepared: PreparedChapterGeneration;
  chapterData: GeneratedChapter;
}

export class ChapterWritingService {
  // 数据库并发：控制 Prisma 读写数量，避免连接池耗尽
  private getDbConcurrency(): number {
    const raw = Number(process.env.DB_CONCURRENCY || process.env.TASK_CONCURRENCY);
    const fallback = process.env.NODE_ENV === 'production' ? 1 : 2;
    if (Number.isFinite(raw) && raw > 0) return Math.floor(raw);
    return fallback;
  }

  // 模型并发：控制 LLM 请求并行数量
  private getLlmConcurrency(): number {
    const raw = Number(process.env.LLM_CONCURRENCY || process.env.AI_CONCURRENCY);
    const fallback = process.env.NODE_ENV === 'production' ? 2 : 3;
    if (Number.isFinite(raw) && raw > 0) return Math.floor(raw);
    return fallback;
  }

  // 通用并发执行器，按固定并发跑队列任务
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

  private async buildChapterSnapshotForBook(bookId: string, chapterNumber: number): Promise<ChapterReadSnapshot | null> {
    const book = await prisma.book.findUnique({
      where: { id: bookId },
      select: { seasonId: true },
    });
    if (!book || !book.seasonId) {
      console.error(`[Chapter] 书籍不存在: ${bookId}`);
      return null;
    }
    const snapshots = await this.buildChapterSnapshots(book.seasonId, chapterNumber, [bookId]);
    return snapshots[0] ?? null;
  }

  private async buildChapterSnapshots(
    seasonId: string,
    chapterNumber: number,
    bookIds?: string[]
  ): Promise<ChapterReadSnapshot[]> {
    const season = await prisma.season.findUnique({
      where: { id: seasonId },
    });
    if (!season) {
      console.error(`[Chapter] 赛季不存在: ${seasonId}`);
      return [];
    }

    const whereCondition: { seasonId: string; status: string; id?: { in: string[] } } = {
      seasonId,
      status: 'ACTIVE',
    };
    if (bookIds && bookIds.length > 0) {
      whereCondition.id = { in: bookIds };
    }

    const allBooks = await prisma.book.findMany({
      where: whereCondition,
      select: {
        id: true,
        title: true,
        zoneStyle: true,
        chaptersPlan: true,
        author: { select: { id: true, nickname: true, agentConfig: true } },
        _count: { select: { chapters: true } },
      },
    });

    const books = allBooks.filter(book => (book._count?.chapters ?? 0) < chapterNumber);
    if (books.length === 0) return [];
    const targetBookIds = books.map((book) => book.id);

    const previousChapters = await prisma.chapter.findMany({
      where: {
        bookId: { in: targetBookIds },
        chapterNumber: { lt: chapterNumber },
      },
      orderBy: { chapterNumber: 'desc' },
      select: { bookId: true, content: true, title: true, chapterNumber: true },
    });

    const previousMap = new Map<string, Array<{ content: string | null; title: string; chapterNumber: number }>>();
    previousChapters.forEach((chapter) => {
      const list = previousMap.get(chapter.bookId) ?? [];
      if (list.length < 2) {
        list.push({ content: chapter.content, title: chapter.title, chapterNumber: chapter.chapterNumber });
        previousMap.set(chapter.bookId, list);
      }
    });

    const feedbackMap = new Map<string, string[]>();
    targetBookIds.forEach((id) => feedbackMap.set(id, []));
    if (chapterNumber > 1) {
      const comments = await prisma.comment.findMany({
        where: {
          bookId: { in: targetBookIds },
          chapter: { chapterNumber: chapterNumber - 1 },
        },
        orderBy: { createdAt: 'desc' },
        select: { bookId: true, content: true },
      });

      comments.forEach((comment) => {
        if (!comment.content || comment.content.length <= 10) return;
        const list = feedbackMap.get(comment.bookId) ?? [];
        if (list.length < 3) {
          list.push(comment.content);
          feedbackMap.set(comment.bookId, list);
        }
      });
    }

    return books.reduce<ChapterReadSnapshot[]>((acc, book) => {
      if (!book.chaptersPlan) {
        console.error(`[Chapter] 书籍 ${book.id} 没有可用的大纲`);
        return acc;
      }
      const chaptersPlan = book.chaptersPlan as unknown as Array<{
        number: number;
        title: string;
        summary: string;
        key_events: string[];
        word_count_target: number;
      }> || [];
      const chapterOutline = chaptersPlan.find(c => c.number === chapterNumber);
      if (!chapterOutline) {
        console.log(`[Chapter] 跳过第 ${chapterNumber} 章：大纲缺失该章信息，现有章节:`, chaptersPlan.map(c => c.number));
        return acc;
      }

      const previousChaptersForBook = previousMap.get(book.id) ?? [];
      const previousSummary = previousChaptersForBook.length > 0
        ? `前情：${previousChaptersForBook.map(c => c.title).join(' -> ')}`
        : '这是本书的第一章';

      let previousChapterContent: string | undefined;
      if (previousChaptersForBook.length > 0) {
        const latestChapter = previousChaptersForBook[0];
        if (latestChapter.content) {
          previousChapterContent = `第${latestChapter.chapterNumber}章"${latestChapter.title}"：` +
            latestChapter.content.slice(0, 300) + '...';
        }
      }

      acc.push({
        bookId: book.id,
        bookTitle: book.title,
        authorId: book.author.id,
        authorNickname: book.author.nickname || '作家',
        authorAgentConfig: book.author.agentConfig as unknown as Record<string, unknown>,
        zoneStyle: book.zoneStyle,
        chapterNumber,
        chapterOutlineTitle: chapterOutline.title,
        chapterOutlineSummary: chapterOutline.summary,
        chapterOutlineKeyEvents: chapterOutline.key_events,
        chapterOutlineWordCount: chapterOutline.word_count_target,
        chaptersPlan,
        seasonTheme: season.themeKeyword,
        seasonConstraints: (season.constraints as unknown as string[]) || [],
        previousSummary,
        previousChapterContent,
        feedbacks: feedbackMap.get(book.id) ?? [],
      });

      return acc;
    }, []);
  }

  private async prepareChapterGeneration(snapshot: ChapterReadSnapshot): Promise<PreparedChapterGeneration | null> {
    const rawConfig = snapshot.authorAgentConfig || {};
    const agentConfig: AgentConfig = {
      writerPersonality: (rawConfig.writerPersonality as string) || '',
      writingStyle: (rawConfig.writingStyle as string) || '多变',
      adaptability: (rawConfig.adaptability as number) ?? 0.5,
      preferredGenres: (rawConfig.preferredGenres as string[]) || [],
      maxChapters: (rawConfig.maxChapters as number) || 5,
      wordCountTarget: (rawConfig.wordCountTarget as number) || 2000,
      selfIntro: (rawConfig.selfIntro as string) || '',
    };

    const systemPrompt = buildAuthorSystemPrompt({
      userName: snapshot.authorNickname || '作家',
      writerPersonality: agentConfig.writerPersonality || '',
      writingStyle: agentConfig.writingStyle || '多变',
      adaptability: agentConfig.adaptability ?? 0.5,
      preferredGenres: agentConfig.preferredGenres || [],
      seasonTheme: snapshot.seasonTheme,
      constraints: snapshot.seasonConstraints,
      zoneStyle: this.normalizeZoneStyle(snapshot.zoneStyle),
      wordCountTarget: agentConfig.wordCountTarget || 2000,
    });

    const chapterPrompt = buildChapterPrompt({
      writerPersonality: agentConfig.writerPersonality || '',
      selfIntro: agentConfig.selfIntro || '',
      writingStyle: agentConfig.writingStyle || '多变',
      wordCountTarget: agentConfig.wordCountTarget || 2000,
      bookTitle: snapshot.bookTitle,
      chapterNumber: snapshot.chapterNumber,
      totalChapters: snapshot.chaptersPlan.length,
      outline: {
        summary: snapshot.chapterOutlineSummary,
        key_events: snapshot.chapterOutlineKeyEvents,
        word_count_target: snapshot.chapterOutlineWordCount,
      },
      fullOutline: snapshot.chaptersPlan,
      previousSummary: snapshot.previousSummary,
      previousChapterContent: snapshot.previousChapterContent || undefined,
      feedbacks: snapshot.feedbacks,
    });

    return {
      bookId: snapshot.bookId,
      bookTitle: snapshot.bookTitle,
      authorId: snapshot.authorId,
      authorNickname: snapshot.authorNickname || '作家',
      chapterNumber: snapshot.chapterNumber,
      chapterOutlineTitle: snapshot.chapterOutlineTitle,
      systemPrompt,
      chapterPrompt,
      bookMaxChapters: agentConfig.maxChapters || 5,
    };
  }

  // 模型生成阶段：只做 LLM 调用与解析
  private async generateChapterContent(prepared: PreparedChapterGeneration): Promise<GeneratedChapter> {
    const authorToken = await getUserTokenById(prepared.authorId);
    if (!authorToken) {
      throw new Error(`无法获取作者 ${prepared.authorNickname} 的 Token`);
    }

    // 调用 LLM 并带重试
    const chapterData = await parseChapterWithRetry(
      () => testModeSendChat(prepared.chapterPrompt, prepared.systemPrompt, 'inksurvivor-writer', authorToken),
      prepared.chapterOutlineTitle,
      {
        taskId: `ChapterWrite-${prepared.bookTitle}-ch${prepared.chapterNumber}`,
        maxRetries: 3,
      }
    );

    console.log(`[ChapterWrite] 解析结果: bookId=${prepared.bookId}, chapter=${prepared.chapterNumber}, title=${chapterData.title}, contentLength=${chapterData.content.length}`);

    if (!chapterData.content) {
      console.error(`[ChapterWrite] 章节内容为空: bookId=${prepared.bookId}, chapter=${prepared.chapterNumber}`);
      throw new Error('LLM 未返回章节内容');
    }

    return chapterData;
  }

  // 写库阶段：落库 + 书籍状态 + 评分 + WebSocket 通知
  private async persistGeneratedChapter(
    prepared: PreparedChapterGeneration,
    chapterData: GeneratedChapter
  ): Promise<{ chapterId: string; bookId: string; chapterNumber: number; title: string }> {
    let newChapter;
    try {
      newChapter = await prisma.chapter.create({
        data: {
          bookId: prepared.bookId,
          chapterNumber: prepared.chapterNumber,
          title: chapterData.title,
          content: chapterData.content,
          status: 'PUBLISHED',
          publishedAt: new Date(),
          contentLength: chapterData.content.length,
        },
      });
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === 'P2002') {
        const existing = await prisma.chapter.findUnique({
          where: {
            bookId_chapterNumber: {
              bookId: prepared.bookId,
              chapterNumber: prepared.chapterNumber,
            },
          },
          select: { id: true, title: true },
        });
        if (existing) {
          console.log(`[Chapter] 章节已存在，跳过写入: bookId=${prepared.bookId}, chapter=${prepared.chapterNumber}, title=${existing.title}`);
          return {
            chapterId: existing.id,
            bookId: prepared.bookId,
            chapterNumber: prepared.chapterNumber,
            title: existing.title,
          };
        }
      }
      throw error;
    }

    console.log(`[Chapter] 章节发布完成: bookId=${prepared.bookId}, chapter=${prepared.chapterNumber}, title=${chapterData.title}, contentLength=${chapterData.content.length}`);

    // 标记是否完结
    const isCompleted = prepared.chapterNumber >= prepared.bookMaxChapters;
    const scoreIncrement = 100 + Math.floor(Math.random() * 50);
    const viewIncrement = Math.floor(Math.random() * 50);

    // 更新书籍当前章节与状态
    await prisma.book.update({
      where: { id: prepared.bookId },
      data: {
        currentChapter: prepared.chapterNumber,
        status: isCompleted ? 'COMPLETED' : 'ACTIVE',
        heatValue: { increment: 100 },
        finalScore: { increment: scoreIncrement },
        viewCount: { increment: viewIncrement },
      },
    });

    if (isCompleted) {
      console.log(`[Chapter] 书籍已完成全部章节: bookId=${prepared.bookId}, maxChapters=${prepared.bookMaxChapters}`);
    }

    // 通知前端章节已发布
    wsEvents.chapterPublished(prepared.bookId, newChapter.chapterNumber, newChapter.title);

    console.log(`[Chapter] 章节创作完成: bookId=${prepared.bookId}, chapter=${prepared.chapterNumber}, title=${newChapter.title}`);
    return {
      chapterId: newChapter.id,
      bookId: prepared.bookId,
      chapterNumber: prepared.chapterNumber,
      title: newChapter.title,
    };
  }

  /**
   * 为单本书创作章节
   */
  async writeChapter(bookId: string, chapterNumber: number): Promise<void> {
    console.log(`[Chapter] 开始创作章节: bookId=${bookId}, chapter=${chapterNumber}`);
    // 单本书写作仍保持顺序：准备 -> 生成 -> 写库
    const snapshot = await this.buildChapterSnapshotForBook(bookId, chapterNumber);
    if (!snapshot) {
      return;
    }
    const prepared = await this.prepareChapterGeneration(snapshot);
    if (!prepared) {
      return;
    }
    const chapterData = await this.generateChapterContent(prepared);
    const persisted = await this.persistGeneratedChapter(prepared, chapterData);
    await readerAgentService.batchDispatchReaderAgents([persisted]);
  }

  /**
   * 为赛季中所有需要创作章节的书籍创作章节
   * @param seasonId - 赛季ID
   * @param chapterNumber - 目标章节号
   * @param bookIds - 可选，指定书籍ID列表（用于过滤）
   */
  async writeChaptersForSeason(seasonId: string, chapterNumber: number, bookIds?: string[]): Promise<void> {
    console.log(`[Chapter] 开始赛季章节创作: seasonId=${seasonId}, chapter=${chapterNumber}, filterBookIds=${bookIds?.length ?? 'all'}`);
    const snapshots = await this.buildChapterSnapshots(seasonId, chapterNumber, bookIds);
    console.log(`[Chapter] 需要创作章节的书籍数量: seasonId=${seasonId}, chapter=${chapterNumber}, count=${snapshots.length}`);

    // 三段式并发：准备(读库) -> LLM生成 -> 写库
    const dbConcurrency = this.getDbConcurrency();
    const llmConcurrency = this.getLlmConcurrency();
    const preparedJobs: PreparedChapterGeneration[] = [];

    // 1) 读库准备阶段
    console.log(`[Chapter][Supabase][读] 准备阶段: seasonId=${seasonId}, chapter=${chapterNumber}, concurrency=${dbConcurrency}`);
    await this.runWithConcurrency(snapshots, dbConcurrency, async (snapshot) => {
      const prepared = await this.prepareChapterGeneration(snapshot);
      if (prepared) {
        preparedJobs.push(prepared);
      }
    });

    // 2) 模型生成阶段
    const generatedJobs: ChapterWriteJob[] = [];
    console.log(`[Chapter][LLM] 生成阶段: seasonId=${seasonId}, chapter=${chapterNumber}, concurrency=${llmConcurrency}`);
    await this.runWithConcurrency(preparedJobs, llmConcurrency, async (prepared) => {
      const chapterData = await this.generateChapterContent(prepared).catch(error => {
        console.error(`[Chapter] 章节生成失败: bookId=${prepared.bookId}, chapter=${chapterNumber}`, error);
        return null;
      });
      if (chapterData) {
        generatedJobs.push({ prepared, chapterData });
      }
    });

    // 3) 写库阶段
    const persistedChapters: Array<{ chapterId: string; bookId: string; chapterNumber: number; title: string }> = [];
    console.log(`[Chapter][Supabase][写] 发布阶段: seasonId=${seasonId}, chapter=${chapterNumber}, concurrency=${dbConcurrency}`);
    await this.runWithConcurrency(generatedJobs, dbConcurrency, async (job) => {
      const persisted = await this.persistGeneratedChapter(job.prepared, job.chapterData).catch(error => {
        console.error(`[Chapter] 章节发布失败: bookId=${job.prepared.bookId}, chapter=${chapterNumber}`, error);
        return null;
      });
      if (persisted) {
        persistedChapters.push(persisted);
      }
    });
    await readerAgentService.batchDispatchReaderAgents(persistedChapters.map((item) => ({
      chapterId: item.chapterId,
      bookId: item.bookId,
      chapterNumber: item.chapterNumber,
    })));
    console.log(`[Chapter] 赛季章节创作完成: seasonId=${seasonId}, chapter=${chapterNumber}, publishedCount=${persistedChapters.length}`);
  }

  /**
   * 追赶模式：为落后书籍补齐缺失章节
   *
   * 场景：赛季已进行到第 N 轮，但某些书籍只创作到第 M 章 (M < N)
   * 逻辑：
   * 1. 生成大纲（如没有）
   * 2. 检测真正缺失的章节（可能不是连续的，如只有3、4、5章，缺失1、2章）
   * 3. 带重试地补齐缺失章节 + 当前轮次章节
   */
  async catchUpBooks(seasonId: string, targetRound: number): Promise<void> {
    console.log(`[CatchUp] 开始追赶模式: seasonId=${seasonId}, targetRound=${targetRound}`);

    // 1. 获取落后书籍（章节数 < 目标轮次）
    const allBooks = await prisma.book.findMany({
      where: {
        seasonId,
        status: 'ACTIVE',
      },
      include: {
        _count: { select: { chapters: true } },
        chapters: { select: { chapterNumber: true } }, // 获取所有章节编号
        author: { select: { agentConfig: true } },
      },
    });

    // 筛选当前章节数小于目标轮次的书籍
    const books = allBooks.filter(book => book._count.chapters < targetRound);

    if (books.length === 0) {
      console.log(`[CatchUp] 没有需要追赶的书籍`);
      return;
    }

    console.log(`[CatchUp] 需要追赶的书籍数量: seasonId=${seasonId}, targetRound=${targetRound}, count=${books.length}`);

    const missingChaptersByBook = new Map<string, number[]>();
    const missingByRound = new Map<number, string[]>();
    books.forEach((book) => {
      const existingChapterNumbers = new Set(book.chapters.map(c => c.chapterNumber));
      const missingChapters: number[] = [];
      for (let i = 1; i <= targetRound; i++) {
        if (!existingChapterNumbers.has(i)) {
          missingChapters.push(i);
        }
      }
      console.log(`[CatchUp] 书籍缺失章节: bookId=${book.id}, currentChapters=${book._count.chapters}, existing=${Array.from(existingChapterNumbers).sort((a, b) => a - b).join(', ')}, missing=${missingChapters.join(', ')}`);
      if (missingChapters.length === 0) {
        console.log(`[CatchUp] 书籍《${book.title}》没有缺失章节需要补`);
        return;
      }
      missingChaptersByBook.set(book.id, missingChapters);
      missingChapters.forEach((chapterNum) => {
        const list = missingByRound.get(chapterNum) ?? [];
        if (!list.includes(book.id)) {
          list.push(book.id);
        }
        missingByRound.set(chapterNum, list);
      });
    });

    if (missingChaptersByBook.size === 0) {
      console.log('[CatchUp] 没有缺失章节需要追赶');
      return;
    }

    const booksWithoutOutline = books.filter((book) => !book.chaptersPlan);
    if (booksWithoutOutline.length > 0) {
      const llmConcurrency = this.getLlmConcurrency();
      await this.runWithConcurrency(booksWithoutOutline, llmConcurrency, async (book) => {
        console.log(`[CatchUp] 书籍《${book.title}》没有大纲，生成整本书大纲`);
        await outlineGenerationService.generateOutline(book.id).catch((error) => {
          console.error(`[CatchUp] 书籍《${book.title}》大纲生成失败:`, error);
        });
      });
    }

    const chaptersPlanMap = new Map<string, Array<{ number: number }>>();
    books.forEach((book) => {
      chaptersPlanMap.set(book.id, (book.chaptersPlan as unknown as Array<{ number: number }>) || []);
    });
    if (booksWithoutOutline.length > 0) {
      const refreshed = await prisma.book.findMany({
        where: { id: { in: booksWithoutOutline.map(book => book.id) } },
        select: { id: true, chaptersPlan: true },
      });
      refreshed.forEach((book) => {
        chaptersPlanMap.set(book.id, (book.chaptersPlan as unknown as Array<{ number: number }>) || []);
      });
    }

    const needOutlineByRound = new Map<number, string[]>();
    missingChaptersByBook.forEach((missingChapters, bookId) => {
      const chaptersPlan = chaptersPlanMap.get(bookId) ?? [];
      const outlineChapterNumbers = new Set(chaptersPlan.map(c => c.number));
      missingChapters.forEach((chapterNum) => {
        if (!outlineChapterNumbers.has(chapterNum)) {
          const list = needOutlineByRound.get(chapterNum) ?? [];
          if (!list.includes(bookId)) {
            list.push(bookId);
          }
          needOutlineByRound.set(chapterNum, list);
        }
      });
    });

    const outlineRounds = Array.from(needOutlineByRound.keys()).sort((a, b) => a - b);
    for (const chapterNum of outlineRounds) {
      const bookIds = needOutlineByRound.get(chapterNum) ?? [];
      if (bookIds.length === 0) continue;
      console.log(`[CatchUp] 需要生成第 ${chapterNum} 章大纲的书籍数: ${bookIds.length}`);
      await outlineGenerationService.generateNextChapterOutlinesForBooks(bookIds, chapterNum);
    }

    const writeRounds = Array.from(missingByRound.keys()).sort((a, b) => a - b);
    for (const chapterNum of writeRounds) {
      const bookIds = missingByRound.get(chapterNum) ?? [];
      if (bookIds.length === 0) continue;
      await this.writeChaptersForSeason(seasonId, chapterNum, bookIds);
    }

    console.log(`[CatchUp] 追赶模式完成 - ${books.length} 本书籍已处理`);
  }

  /**
   * 单本书的章节补全
   *
   * 用于书籍详情页的"补全章节"按钮
   * 根据最新大纲检测缺失章节并补全
   */
  async catchUpSingleBook(bookId: string, targetRound: number): Promise<void> {
    console.log(`[CatchUpSingle] 开始为书籍 ${bookId} 补全章节，目标轮次: ${targetRound}`);

    // 1. 获取书籍信息
    const book = await prisma.book.findUnique({
      where: { id: bookId },
      include: {
        chapters: { select: { chapterNumber: true } },
        author: { select: { agentConfig: true } },
      },
    });

    if (!book) {
      console.error(`[CatchUpSingle] 书籍不存在: ${bookId}`);
      return;
    }

    // 2. 检查大纲是否存在 - chaptersPlan 是 Book 表的直接字段
    if (!book.chaptersPlan) {
      console.log(`[CatchUpSingle] 书籍《${book.title}》没有大纲，先生成整本书大纲`);
      await outlineGenerationService.generateOutline(bookId);
    }

    // 重新获取大纲
    const existingBook = await prisma.book.findUnique({
      where: { id: bookId },
      select: { chaptersPlan: true },
    });

    const chaptersPlan = (existingBook?.chaptersPlan as unknown as Array<{ number: number }>) || [];
    const outlineChapterNumbers = new Set(chaptersPlan.map((c: { number: number }) => c.number));
    const maxOutlineChapter = Math.max(...Array.from(outlineChapterNumbers), 0);

    // 3. 获取当前已有的章节编号
    const existingChapterNumbers = new Set(book.chapters.map((c: { chapterNumber: number }) => c.chapterNumber));

    // 4. 计算真正缺失的章节（1到max中不存在的）
    const missingChapters: number[] = [];
    const maxChapter = Math.max(targetRound, maxOutlineChapter);
    for (let i = 1; i <= maxChapter; i++) {
      if (!existingChapterNumbers.has(i)) {
        missingChapters.push(i);
      }
    }

    if (missingChapters.length === 0) {
      console.log(`[CatchUpSingle] 书籍《${book.title}》没有缺失章节`);
      return;
    }

    console.log(`[CatchUpSingle] 书籍《${book.title}》缺失章节: ${missingChapters.join(', ')}`);

    // 5. 检查大纲是否包含缺失章节的大纲
    const needGenerateOutline: number[] = [];
    for (const ch of missingChapters) {
      if (!outlineChapterNumbers.has(ch)) {
        needGenerateOutline.push(ch);
      }
    }

    // 为缺失章节生成大纲（按顺序生成）
    for (const ch of needGenerateOutline) {
      console.log(`[CatchUpSingle] 书籍《${book.title}》缺失第 ${ch} 章大纲，生成中...`);
      try {
        await outlineGenerationService.generateNextChapterOutline(bookId, ch);
      } catch (error) {
        console.error(`[CatchUpSingle] 书籍《${book.title}》第 ${ch} 章大纲生成失败:`, error);
      }
    }

    // 6. 按章节顺序补写章节
    for (const chapterNum of missingChapters) {
      try {
        await this.writeChapter(bookId, chapterNum);
      } catch (error) {
        console.error(`[CatchUpSingle] 书籍《${book.title}》第 ${chapterNum} 章失败:`, (error as Error).message);
      }
    }

    console.log(`[CatchUpSingle] 书籍《${book.title}》补全完成 - ${missingChapters.length} 章`);
  }

  /**
   * 标准化分区风格
   */
  private normalizeZoneStyle(zoneStyle: string): string {
    const zoneMap: Record<string, string> = {
      urban: '现代都市',
      fantasy: '玄幻架空',
      scifi: '科幻未来',
    };
    return zoneMap[zoneStyle.toLowerCase()] || zoneStyle;
  }
}

export const chapterWritingService = new ChapterWritingService();
