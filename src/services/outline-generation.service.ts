/**
 * 大纲生成服务
 *
 * OUTLINE 阶段：为书籍生成/优化章节大纲
 * 基于读者反馈和作者性格生成个性化大纲
 */

import { prisma } from '@/lib/prisma';
import { buildAuthorSystemPrompt, buildOutlinePrompt } from '@/lib/secondme/prompts';
import { testModeSendChat, getUserTokenById } from '@/lib/secondme/client';
import { parseLLMJsonWithRetry } from '@/lib/utils/llm-parser';
import { toJsonValue } from '@/lib/utils/jsonb-utils';

// Agent 配置接口
interface AgentConfig {
  // 基础信息
  writerPersonality: string;  // 作者性格描述
  selfIntro?: string;  // 自我介绍
  interestTags?: string[];  // 兴趣标签

  // 写作偏好
  writingStyle: string;      // 写作风格：严肃/幽默/浪漫/悬疑/多变

  // 创作参数
  adaptability: number;     // 听劝指数：0-1
  preferredGenres: string[]; // 偏好题材：['都市', '玄幻', '科幻', ...]
  maxChapters: number;     // 创作风格：3=短篇, 5=中篇, 7=长篇
  wordCountTarget: number;  // 每章目标字数：1000/2000/3000
}

// 单章大纲数据结构
interface ChapterOutline {
  number: number;
  title: string;
  summary: string;
  key_events: string[];
  word_count_target: number;
}

// 大纲数据结构（整本书的大纲）
interface BookOutline {
  title: string;
  summary: string;
  characters: Array<{
    name: string;
    role: string;
    description: string;
    motivation: string;
  }>;
  chapters: ChapterOutline[];
  themes: string[];
  tone: string;
}

// 大纲修改判断结果
interface OutlineModificationDecision {
  shouldModify: boolean;
  targetChapters: number[];  // 要修改的章节列表，如 [2, 3]
  changes: string;           // 修改意见（一段话描述如何修改）
}

interface PreparedOutlineGeneration {
  bookId: string;
  bookTitle: string;
  authorId: string;
  authorNickname: string;
  authorToken: string;
  systemPrompt: string;
  outlinePrompt: string;
  testMode: boolean;
}

interface OutlineReadSnapshot {
  seasonId: string;
  seasonTheme: string;
  seasonConstraints: string[];
  seasonZoneStyles: string[];
  seasonMaxChapters: number;
  seasonMinChapters: number;
  bookId: string;
  bookTitle: string;
  zoneStyle: string;
  chaptersPlan: unknown | null;
  chaptersCount: number;
  authorId: string;
  authorNickname: string;
  authorAgentConfig: Record<string, unknown>;
}

interface NextOutlineSnapshot {
  seasonId: string;
  seasonTheme: string;
  seasonConstraints: string[];
  seasonZoneStyles: string[];
  seasonMaxChapters: number;
  seasonMinChapters: number;
  bookId: string;
  bookTitle: string;
  zoneStyle: string;
  chaptersPlan: ChapterOutline[] | null;
  originalIntent: string | null;
  characters: unknown[] | null;
  currentChapterCount: number;
  nextChapterNumber: number;
  comments: Array<{ type: 'ai' | 'human'; content: string; rating?: number }>;
  authorId: string;
  authorNickname: string;
  authorAgentConfig: Record<string, unknown>;
}

interface OutlineWriteJob {
  bookId: string;
  outlineData: BookOutline;
  roundCreated: number;
  reason: string;
}

export class OutlineGenerationService {
  private getDbConcurrency(): number {
    const raw = Number(process.env.DB_CONCURRENCY || process.env.TASK_CONCURRENCY);
    const fallback = 3;
    if (Number.isFinite(raw) && raw > 0) return Math.min(3, Math.floor(raw));
    return fallback;
  }

  private getLlmConcurrency(): number {
    const raw = Number(process.env.LLM_CONCURRENCY || process.env.AI_CONCURRENCY);
    const fallback = process.env.NODE_ENV === 'production' ? 2 : 3;
    if (Number.isFinite(raw) && raw > 0) return Math.floor(raw);
    return fallback;
  }

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

  private async buildOutlineSnapshots(seasonId: string): Promise<OutlineReadSnapshot[]> {
    const season = await prisma.season.findUnique({
      where: { id: seasonId },
    });

    if (!season) {
      console.error(`[Outline] 赛季不存在: ${seasonId}`);
      return [];
    }

    const books = await prisma.book.findMany({
      where: {
        seasonId,
        status: 'ACTIVE',
      },
      include: {
        author: { select: { id: true, nickname: true, agentConfig: true } },
        _count: { select: { chapters: true } },
      },
      orderBy: { heatValue: 'desc' },
    });

    return books.map((book) => ({
      seasonId,
      seasonTheme: season.themeKeyword,
      seasonConstraints: season.constraints as unknown as string[],
      seasonZoneStyles: season.zoneStyles as unknown as string[],
      seasonMaxChapters: season.maxChapters || 7,
      seasonMinChapters: season.minChapters || 3,
      bookId: book.id,
      bookTitle: book.title,
      zoneStyle: book.zoneStyle,
      chaptersPlan: book.chaptersPlan,
      chaptersCount: book._count?.chapters ?? 0,
      authorId: book.author.id,
      authorNickname: book.author.nickname || '作家',
      authorAgentConfig: book.author.agentConfig as unknown as Record<string, unknown>,
    }));
  }

  private async buildOutlineSnapshotForBook(bookId: string): Promise<OutlineReadSnapshot | null> {
    const book = await prisma.book.findUnique({
      where: { id: bookId },
      include: {
        author: { select: { id: true, nickname: true, agentConfig: true } },
        _count: { select: { chapters: true } },
      },
    });

    if (!book) {
      console.error(`[Outline] 书籍不存在: ${bookId}`);
      return null;
    }

    const season = await prisma.season.findUnique({
      where: { id: book.seasonId ?? undefined },
    });

    if (!season) {
      console.error(`[Outline] 赛季不存在: ${book.seasonId}`);
      return null;
    }

    return {
      seasonId: season.id,
      seasonTheme: season.themeKeyword,
      seasonConstraints: season.constraints as unknown as string[],
      seasonZoneStyles: season.zoneStyles as unknown as string[],
      seasonMaxChapters: season.maxChapters || 7,
      seasonMinChapters: season.minChapters || 3,
      bookId: book.id,
      bookTitle: book.title,
      zoneStyle: book.zoneStyle,
      chaptersPlan: book.chaptersPlan,
      chaptersCount: book._count?.chapters ?? 0,
      authorId: book.author.id,
      authorNickname: book.author.nickname || '作家',
      authorAgentConfig: book.author.agentConfig as unknown as Record<string, unknown>,
    };
  }

  private async buildNextOutlineSnapshots(bookIds: string[], targetRound?: number): Promise<NextOutlineSnapshot[]> {
    if (bookIds.length === 0) return [];
    const books = await prisma.book.findMany({
      where: { id: { in: bookIds } },
      select: {
        id: true,
        title: true,
        zoneStyle: true,
        seasonId: true,
        chaptersPlan: true,
        originalIntent: true,
        characters: true,
        author: { select: { id: true, nickname: true, agentConfig: true } },
        _count: { select: { chapters: true } },
      },
    });

    if (books.length === 0) return [];

    const seasonIds = Array.from(new Set(books.map((book) => book.seasonId).filter((id): id is string => Boolean(id))));
    const seasons = await prisma.season.findMany({
      where: { id: { in: seasonIds } },
    });
    const seasonMap = new Map(seasons.map((season) => [season.id, season]));

    const chapterCountMap = new Map<string, number>();
    books.forEach((book) => {
      chapterCountMap.set(book.id, book._count?.chapters ?? 0);
    });

    const commentsMap = await this.buildAllChapterComments(bookIds, chapterCountMap);

    const snapshots: NextOutlineSnapshot[] = [];
    books.forEach((book) => {
      if (!book.seasonId) {
        console.error(`[Outline] 赛季不存在: ${book.seasonId}`);
        return;
      }
      const season = seasonMap.get(book.seasonId);
      if (!season) {
        console.error(`[Outline] 赛季不存在: ${book.seasonId}`);
        return;
      }
      const currentChapterCount = chapterCountMap.get(book.id) ?? 0;
      const nextChapterNumber = targetRound ?? currentChapterCount + 1;
      const comments = commentsMap.get(book.id) ?? [];

      snapshots.push({
        seasonId: season.id,
        seasonTheme: season.themeKeyword,
        seasonConstraints: season.constraints as unknown as string[],
        seasonZoneStyles: season.zoneStyles as unknown as string[],
        seasonMaxChapters: season.maxChapters || 7,
        seasonMinChapters: season.minChapters || 3,
        bookId: book.id,
        bookTitle: book.title,
        zoneStyle: book.zoneStyle,
        chaptersPlan: book.chaptersPlan as unknown as ChapterOutline[] | null,
        originalIntent: book.originalIntent,
        characters: book.characters as unknown[] | null,
        currentChapterCount,
        nextChapterNumber,
        comments,
        authorId: book.author.id,
        authorNickname: book.author.nickname || '作家',
        authorAgentConfig: book.author.agentConfig as unknown as Record<string, unknown>,
      });
    });

    return snapshots;
  }

  private async buildAllChapterComments(
    bookIds: string[],
    chapterCountMap: Map<string, number>
  ): Promise<Map<string, Array<{ type: 'ai' | 'human'; content: string; rating?: number }>>> {
    const maxChapterNumber = Math.max(0, ...Array.from(chapterCountMap.values()));
    const result = new Map<string, Array<{ type: 'ai' | 'human'; content: string; rating?: number }>>();
    bookIds.forEach((bookId) => result.set(bookId, []));
    if (maxChapterNumber <= 0) return result;

    const comments = await prisma.comment.findMany({
      where: {
        bookId: { in: bookIds },
        chapter: { chapterNumber: { lte: maxChapterNumber } },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        bookId: true,
        isHuman: true,
        content: true,
        rating: true,
        createdAt: true,
        chapter: { select: { chapterNumber: true } },
      },
    });

    const grouped = new Map<string, Map<number, Array<{
      type: 'ai' | 'human';
      content: string;
      rating?: number;
      createdAt: Date;
    }>>>();

    comments.forEach((comment) => {
      if (!comment.content) return;
      const chapterNumber = comment.chapter?.chapterNumber;
      if (!chapterNumber) return;
      let byChapter = grouped.get(comment.bookId);
      if (!byChapter) {
        byChapter = new Map<number, Array<{
          type: 'ai' | 'human';
          content: string;
          rating?: number;
          createdAt: Date;
        }>>();
        grouped.set(comment.bookId, byChapter);
      }
      const list = byChapter.get(chapterNumber) ?? [];
      list.push({
        type: comment.isHuman ? 'human' : 'ai',
        content: comment.content,
        rating: comment.rating ?? undefined,
        createdAt: comment.createdAt,
      });
      byChapter.set(chapterNumber, list);
    });

    bookIds.forEach((bookId) => {
      const chapterCount = chapterCountMap.get(bookId) ?? 0;
      const byChapter = grouped.get(bookId) ?? new Map<number, Array<{
        type: 'ai' | 'human';
        content: string;
        rating?: number;
        createdAt: Date;
      }>>();
      const merged: Array<{ type: 'ai' | 'human'; content: string; rating?: number }> = [];
      for (let chapterNumber = 1; chapterNumber <= chapterCount; chapterNumber += 1) {
        const items = byChapter.get(chapterNumber) ?? [];
        items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        merged.push(...items.slice(0, 20).map((item) => ({
          type: item.type,
          content: item.content,
          rating: item.rating,
        })));
      }
      result.set(bookId, merged);
    });

    return result;
  }

  private async prepareOutlineGeneration(snapshot: OutlineReadSnapshot, testMode: boolean): Promise<PreparedOutlineGeneration | null> {
    if (!testMode && snapshot.chaptersPlan) {
      console.log(`[Outline] 书籍《${snapshot.bookTitle}》已有大纲，跳过生成`);
      return null;
    }

    const rawConfig = snapshot.authorAgentConfig;
    const agentConfig: AgentConfig = {
      writerPersonality: (rawConfig.writerPersonality as string) || '',
      writingStyle: (rawConfig.writingStyle as string) || '多变',
      adaptability: (rawConfig.adaptability as number) ?? 0.5,
      preferredGenres: (rawConfig.preferredGenres as string[]) || [],
      maxChapters: (rawConfig.maxChapters as number) || 5,
      wordCountTarget: (rawConfig.wordCountTarget as number) || 2000,
    };

    const userPreferredChapters = agentConfig.maxChapters || 5;

    const chapterPreferenceText = userPreferredChapters <= 3
      ? '短篇小说风格（精简干练，节奏快）'
      : userPreferredChapters >= 7
        ? '长篇小说风格（宏大叙事，细节丰富）'
        : '中篇小说风格（平衡适当，详略得当）';

    const systemPrompt = buildAuthorSystemPrompt({
      userName: snapshot.authorNickname,
      writerPersonality: agentConfig.writerPersonality || '',
      writingStyle: agentConfig.writingStyle || '多变',
      adaptability: agentConfig.adaptability ?? 0.5,
      preferredGenres: agentConfig.preferredGenres || [],
      seasonTheme: snapshot.seasonTheme,
      constraints: snapshot.seasonConstraints,
      zoneStyle: this.normalizeZoneStyle(snapshot.zoneStyle),
      wordCountTarget: agentConfig.wordCountTarget || 2000,
    });

    const outlinePrompt = buildOutlinePrompt({
      writerPersonality: agentConfig.writerPersonality || '',
      writingStyle: agentConfig.writingStyle || '多变',
      adaptability: agentConfig.adaptability ?? 0.5,
      preferredGenres: agentConfig.preferredGenres || [],
      wordCountTarget: agentConfig.wordCountTarget || 2000,
      seasonTheme: snapshot.seasonTheme,
      constraints: snapshot.seasonConstraints,
      zoneStyle: this.normalizeZoneStyle(snapshot.zoneStyle),
      minChapters: snapshot.seasonMinChapters,
      maxChapters: snapshot.seasonMaxChapters,
      chapterPreference: chapterPreferenceText,
    });

    const authorToken = await getUserTokenById(snapshot.authorId);
    if (!authorToken) {
      throw new Error(`无法获取作者 ${snapshot.authorNickname} 的 Token`);
    }

    return {
      bookId: snapshot.bookId,
      bookTitle: snapshot.bookTitle,
      authorId: snapshot.authorId,
      authorNickname: snapshot.authorNickname,
      authorToken,
      systemPrompt,
      outlinePrompt,
      testMode,
    };
  }

  private async generateOutlineContent(prepared: PreparedOutlineGeneration): Promise<BookOutline> {
    return parseLLMJsonWithRetry<BookOutline>(
      () => testModeSendChat(prepared.outlinePrompt, prepared.systemPrompt, 'inksurvivor-outline', prepared.authorToken),
      {
        taskId: `OutlineGen-${prepared.bookTitle}`,
        maxRetries: 3,
      }
    );
  }

  private async persistOutline(
    prepared: PreparedOutlineGeneration,
    outlineData: BookOutline
  ): Promise<OutlineWriteJob | {
    title: string;
    summary: string;
    characters: unknown[];
    chapters: unknown[];
  } | null> {
    if (prepared.testMode) {
      console.log(`[Outline] 测试模式：跳过保存，直接返回大纲数据`);
      return {
        title: outlineData.title,
        summary: outlineData.summary,
        characters: outlineData.characters,
        chapters: outlineData.chapters,
      };
    }

    return {
      bookId: prepared.bookId,
      outlineData,
      roundCreated: 1,
      reason: '初始版本',
    };
  }

  private async persistOutlineBatch(jobs: OutlineWriteJob[]): Promise<void> {
    if (jobs.length === 0) return;
    const dbConcurrency = this.getDbConcurrency();
    console.log(`[Outline][Supabase][写] 批量写入 ${jobs.length} 本书大纲, 并发=${dbConcurrency}`);
    await this.runWithConcurrency(jobs, dbConcurrency, async (job) => {
      const chapters = Array.isArray(job.outlineData.chapters) ? job.outlineData.chapters : [];
      if (chapters.length === 0) {
        console.warn(`[Outline] 大纲缺少章节数据，跳过保存: bookId=${job.bookId}, title=${job.outlineData.title || ''}`);
        return;
      }
      const characters = Array.isArray(job.outlineData.characters) ? job.outlineData.characters : [];

      await prisma.book.update({
        where: { id: job.bookId },
        data: {
          originalIntent: job.outlineData.summary,
          chaptersPlan: toJsonValue(chapters),
          characters: toJsonValue(characters),
        },
      });

      await this.saveOutlineVersion(job.bookId, job.roundCreated, job.reason);

      console.log(`[Outline] 书籍 ${job.bookId} 大纲生成完成 - ${chapters.length} 章`);
      console.log(`[Outline] 大纲章节列表:`, chapters.map(c => c.number));
    });
  }

  /**
   * 为单本书生成大纲（整本书的 5 章大纲）
   * @param bookId - 书籍ID
   * @param testMode - 测试模式：true 时跳过数据库检查，且不保存到数据库，直接返回大纲数据
   */
  async generateOutline(bookId: string, testMode: boolean = false): Promise<{
    title: string;
    summary: string;
    characters: unknown[];
    chapters: unknown[];
  } | null> {
    console.log(`[Outline] 开始为书籍 ${bookId} 生成大纲${testMode ? ' (测试模式)' : ''}`);
    const snapshot = await this.buildOutlineSnapshotForBook(bookId);
    if (!snapshot) {
      return null;
    }
    const prepared = await this.prepareOutlineGeneration(snapshot, testMode);
    if (!prepared) {
      return null;
    }
    const outlineData = await this.generateOutlineContent(prepared);
    const result = await this.persistOutline(prepared, outlineData);
    if (result && 'outlineData' in result) {
      await this.persistOutlineBatch([result]);
      return null;
    }
    return result;
  }

  /**
   * 为单本书生成或优化特定章节的大纲
   * 每次 OUTLINE 阶段只处理一本书的下一章
   *
   * 新逻辑（第2轮及以后）：
   * 1. 获取上一章的读者评论（Top 3 AI + 人类评论）
   * 2. 调用 LLM 判断"是否根据反馈修改大纲"
   * 3. 结合 adaptability（听劝程度）决定
   * 4. 如果改 → 修改大纲 → 保存新版本 → 生成第 N 章大纲
   * 5. 如果不改 → 直接生成第 N 章大纲
   * @param bookId - 书籍ID
   * @param targetRound - 目标轮次（可选，不传则根据章节数计算）
   * @param testMode - 测试模式：true 时即使大纲存在也重新生成，且不写入数据库，返回生成的大纲
   * @param testComments - 测试用的人类评论（可选，仅在测试模式使用）
   */
  async generateNextChapterOutline(bookId: string, targetRound?: number, testMode?: boolean, testComments?: Array<{ type: 'ai' | 'human'; content: string; rating?: number }>): Promise<{
    title: string;
    summary: string;
    characters: unknown[];
    chapters: unknown[];
    originalChapters?: unknown[]; // 优化前的大纲（用于对比）
  } | null> {
    console.log(`[Outline] 开始为书籍 ${bookId} 生成下一章大纲${testMode ? ' (测试模式)' : ''}`);
    const snapshots = await this.buildNextOutlineSnapshots([bookId], targetRound);
    const snapshot = snapshots[0];
    if (!snapshot) {
      console.error(`[Outline] 书籍不存在: ${bookId}`);
      return null;
    }
    return this.generateNextChapterOutlineFromSnapshot(snapshot, targetRound, testMode, testComments);
  }

  private async generateNextChapterOutlineFromSnapshot(
    snapshot: NextOutlineSnapshot,
    targetRound?: number,
    testMode?: boolean,
    testComments?: Array<{ type: 'ai' | 'human'; content: string; rating?: number }>
  ): Promise<{
    title: string;
    summary: string;
    characters: unknown[];
    chapters: unknown[];
    originalChapters?: unknown[];
  } | null> {
    const bookId = snapshot.bookId;

    console.log(`[Outline] 书籍《${snapshot.bookTitle}》当前 ${snapshot.currentChapterCount} 章，目标轮次 ${targetRound ?? '未指定'}，生成第 ${snapshot.nextChapterNumber} 章大纲`);

    const agentConfig: AgentConfig = snapshot.authorAgentConfig as unknown as AgentConfig;
    const maxChapters = agentConfig.maxChapters || 5;
    if (snapshot.nextChapterNumber > maxChapters) {
      console.log(`[Outline] 书籍《${snapshot.bookTitle}》已完成所有 ${maxChapters} 章，跳过大纲生成`);
      return null;
    }

    if (!snapshot.chaptersPlan) {
      await this.generateOutline(bookId);
      return null;
    }

    const chaptersPlan = snapshot.chaptersPlan;
    const existingChapterOutline = chaptersPlan.find((c) => c.number === snapshot.nextChapterNumber);
    if (existingChapterOutline && !testMode) {
      console.log(`[Outline] 第 ${snapshot.nextChapterNumber} 章大纲已存在`);
      return null;
    }
    if (existingChapterOutline && testMode) {
      console.log(`[Outline] 测试模式：第 ${snapshot.nextChapterNumber} 章大纲已存在，仍重新生成`);
    }

    let allComments: Array<{ type: 'ai' | 'human'; content: string; rating?: number }> = [];
    if (testMode && testComments && testComments.length > 0) {
      allComments = testComments;
      console.log(`[Outline] 测试模式：使用传入的测试评论 ${allComments.length} 条`);
    } else {
      allComments = snapshot.comments;
    }

    const bookOutline: BookOutline = {
      title: snapshot.bookTitle,
      summary: snapshot.originalIntent || '',
      characters: (snapshot.characters as unknown as Array<{
        name: string;
        role: string;
        description: string;
        motivation: string;
      }>) || [],
      chapters: chaptersPlan,
      themes: [],
      tone: '',
    };

    const adaptability = agentConfig.adaptability ?? 0.5;
    const adaptabilityThreshold = 0.35;
    if (adaptability < adaptabilityThreshold) {
      console.log(`[Outline] 听劝指数 ${adaptability} < ${adaptabilityThreshold}，固执己见，直接返回原大纲，不进行LLM判断`);
      return {
        title: snapshot.bookTitle,
        summary: snapshot.originalIntent || '',
        characters: (snapshot.characters as unknown[]) || [],
        chapters: chaptersPlan,
        originalChapters: chaptersPlan,
      };
    }

    const decision = await this.shouldModifyOutline(
      bookId,
      snapshot.nextChapterNumber,
      agentConfig.adaptability ?? 0.5,
      bookOutline,
      allComments
    );

    let updatedChapters = chaptersPlan;

    // 如果判断需要修改大纲
    if (decision.shouldModify && decision.targetChapters.length > 0) {
      console.log(`[Outline] 判断需要修改大纲，targetChapters: ${decision.targetChapters}, changes: ${decision.changes}`);

      try {
        // 修改大纲，获取目标章节的新大纲
        const modifiedChapters = await this.modifyOutline(
          bookId,
          snapshot.nextChapterNumber,
          agentConfig,
          bookOutline,
          decision
        );

        // 合并：保留其他章节的大纲，替换目标章节
        const targetSet = new Set(decision.targetChapters);
        const otherChapters = chaptersPlan.filter(c => !targetSet.has(c.number));
        updatedChapters = [...otherChapters, ...modifiedChapters].sort((a, b) => a.number - b.number);

        console.log(`[Outline] 目标章节大纲修改完成`);

        // 测试模式返回
        return {
          title: snapshot.bookTitle,
          summary: snapshot.originalIntent || '',
          characters: (snapshot.characters as unknown[]) || [],
          chapters: updatedChapters,
          originalChapters: chaptersPlan,
        };
      } catch (error) {
        console.error(`[Outline] 大纲修改失败，继续生成新章节:`, error);
      }
    } else {
      console.log(`[Outline] 判断不需要修改大纲，原因: ${decision.changes}`);
    }

    // ===== 如果不需要修改，直接返回原大纲 =====
    console.log(`[Outline] 直接返回原大纲，不生成新章节`);
    return {
      title: snapshot.bookTitle,
      summary: snapshot.originalIntent || '',
      characters: (snapshot.characters as unknown[]) || [],
      chapters: chaptersPlan,
      originalChapters: chaptersPlan,
    };
  }

  async generateNextChapterOutlinesForBooks(bookIds: string[], targetRound?: number): Promise<void> {
    const snapshots = await this.buildNextOutlineSnapshots(bookIds, targetRound);
    if (snapshots.length === 0) {
      console.log('[Outline] 没有需要生成下一章大纲的书籍');
      return;
    }
    const llmConcurrency = this.getLlmConcurrency();
    await this.runWithConcurrency(snapshots, llmConcurrency, async (snapshot) => {
      await this.generateNextChapterOutlineFromSnapshot(snapshot, targetRound, false).catch((error) => {
        console.error(`[Outline] 书籍《${snapshot.bookTitle}》下一章大纲生成失败:`, error);
      });
    });
  }

  /**
   * 获取章节概要
      zoneStyle: this.normalizeZoneStyle(book.zoneStyle),
      wordCountTarget: agentConfig.wordCountTarget || 2000,
    });

    // 构建单章大纲生成提示（直接生成，包含评论作为参考）
    // 将评论转换为字符串数组
    const feedbacksStrings: string[] = allComments.map(c =>
      c.rating ? `[${c.type.toUpperCase()}] ${c.content} (评分: ${c.rating}/10)` : `[${c.type.toUpperCase()}] ${c.content}`
    );

    // 获取当前目标章节已有的简要大纲（用于约束不能完全重写）
    const existingChapter = chaptersPlan.find(c => c.number === nextChapterNumber);

    const chapterPrompt = this.buildSingleChapterPrompt({
      bookTitle: book.title,
      chapterNumber: nextChapterNumber,
      previousChapterSummary: currentChapterCount > 0
        ? this.getChapterSummary(chaptersPlan, currentChapterCount)
        : '这是本书的第一章',
      previousChapterContent: previousChapterContent || undefined,
      existingChapterOutline: existingChapter ? {
        title: existingChapter.title,
        summary: existingChapter.summary,
      } : undefined,
      feedbacks: feedbacksStrings,  // 使用转换后的字符串数组
      isLastChapter: nextChapterNumber >= (season.maxChapters || 5),
    });

    // 调用 LLM 生成章节大纲（只调1次）
    const authorToken = await getUserTokenById(book.author.id);
    if (!authorToken) {
      console.error(`[Outline] 无法获取作者 ${book.author.nickname} 的 Token`);
      return null;
    }

    let response: string;
    try {
      response = await testModeSendChat(chapterPrompt, systemPrompt, 'inksurvivor-outline', authorToken);
    } catch (error) {
      console.error(`[Outline] LLM 调用失败:`, error);
      return null;
    }

    // 解析响应
    let newChapterOutline: ChapterOutline;
    try {
      newChapterOutline = await parseLLMJsonWithRetry<ChapterOutline>(
        () => Promise.resolve(response),
        {
          taskId: `Outline-${book.title}-ch${nextChapterNumber}`,
          maxRetries: 2,
        }
      );
    } catch (error) {
      console.error(`[Outline] 解析章节大纲失败:`, error);
      return null;
    }

    // 替换目标章节大纲（如果已存在则替换，否则新增）
    const targetChapter = nextChapterNumber;
    const otherChapters = chaptersPlan.filter(c => c.number !== targetChapter);
    const finalChapters = [...otherChapters, newChapterOutline].sort((a, b) => a.number - b.number);

    // 测试模式：返回生成的大纲
    if (testMode) {
      console.log(`[Outline] 测试模式：第 ${targetChapter} 章大纲生成完成（直接替换旧大纲）`);
      return {
        title: book.title,
        summary: existingBook?.originalIntent || '',
        characters: (existingBook?.characters as unknown[]) || [],
        chapters: finalChapters,
        originalChapters: chaptersPlan,
      };
    }

    // 正常模式：保存到数据库
    await prisma.book.update({
      where: { id: bookId },
      data: {
        chaptersPlan: toJsonValue(finalChapters),
      },
    });
    console.log(`[Outline] 书籍《${book.title}》第 ${nextChapterNumber} 章大纲生成完成`);

    // 正常模式也返回生成的大纲（可选）
    return null;
  }

  /**
   * 为赛季中所有活跃书籍生成下一章大纲
   * 每次 OUTLINE 阶段为一本书生成下一章大纲
   */
  async generateOutlinesForSeason(seasonId: string): Promise<void> {
    console.log(`[Outline] 开始为赛季 ${seasonId} 生成下一章大纲`);

    const snapshots = await this.buildOutlineSnapshots(seasonId);
    console.log(`[Outline] 发现 ${snapshots.length} 本活跃书籍`);

    // 2. 只为第一章的书籍生成大纲（后续轮次按需处理）
    const booksNeedingOutline = snapshots.filter((b) => b.chaptersCount === 0);

    if (booksNeedingOutline.length === 0) {
      console.log(`[Outline] 所有书籍已有大纲`);
      return;
    }

    console.log(`[Outline] 需要生成大纲的书籍: ${booksNeedingOutline.length} 本`);

    const dbConcurrency = this.getDbConcurrency();
    const llmConcurrency = this.getLlmConcurrency();
    const preparedJobs: PreparedOutlineGeneration[] = [];

    console.log(`[Outline][Supabase][读] 准备阶段, 并发=${dbConcurrency}`);
    await this.runWithConcurrency(booksNeedingOutline, dbConcurrency, async (snapshot) => {
      const prepared = await this.prepareOutlineGeneration(snapshot, false).catch((error) => {
        console.error(`[Outline] 书籍《${snapshot.bookTitle}》大纲准备失败:`, error);
        return null;
      });
      if (prepared) {
        preparedJobs.push(prepared);
      }
    });

    const generatedJobs: Array<{ prepared: PreparedOutlineGeneration; outlineData: BookOutline }> = [];
    console.log(`[Outline][LLM] 生成阶段, 并发=${llmConcurrency}`);
    await this.runWithConcurrency(preparedJobs, llmConcurrency, async (prepared) => {
      const outlineData = await this.generateOutlineContent(prepared).catch((error) => {
        console.error(`[Outline] 书籍《${prepared.bookTitle}》大纲生成失败:`, error);
        return null;
      });
      if (outlineData) {
        generatedJobs.push({ prepared, outlineData });
      }
    });

    const writeJobs: OutlineWriteJob[] = [];
    console.log(`[Outline][Supabase][写] 预写阶段, 并发=${dbConcurrency}`);
    await this.runWithConcurrency(generatedJobs, dbConcurrency, async (job) => {
      const result = await this.persistOutline(job.prepared, job.outlineData).catch((error) => {
        console.error(`[Outline] 书籍《${job.prepared.bookTitle}》大纲写入失败:`, error);
        return null;
      });
      if (result && 'outlineData' in result) {
        writeJobs.push(result);
      }
    });
    await this.persistOutlineBatch(writeJobs);
    console.log(`[Outline] 赛季 ${seasonId} 大纲生成完成`);
  }

  /**
   * 判断是否需要根据反馈修改大纲
   * 基于 adaptability（听劝程度）和读者反馈决定
   */
  private async shouldModifyOutline(
    bookId: string,
    currentRound: number,
    adaptability: number,
    existingOutline: BookOutline | null,
    recentComments: Array<{ type: 'ai' | 'human'; content: string; rating?: number }>
  ): Promise<OutlineModificationDecision> {
    console.log(`[Outline] 判断是否需要修改大纲 - adaptability: ${adaptability}, 评论数: ${recentComments.length}`);

    // 如果没有评论，倾向于不修改
    if (recentComments.length === 0) {
      return {
        shouldModify: false,
        targetChapters: [],
        changes: '暂无读者反馈，暂不需要修改大纲',
      };
    }

    // 获取书籍作者信息以获取 token
    const book = await prisma.book.findUnique({
      where: { id: bookId },
      include: { author: { select: { id: true, nickname: true } } },
    });
    if (!book) {
      return { shouldModify: false, targetChapters: [], changes: '书籍不存在' };
    }

    const authorToken = await getUserTokenById(book.author.id);
    if (!authorToken) {
      console.error(`[Outline] 无法获取作者 ${book.author.nickname} 的 Token`);
      return { shouldModify: false, targetChapters: [], changes: '无法获取 Token' };
    }

    // 构建判断 prompt
    const systemPrompt = '你是本书的作者，你需要判断是否需要根据读者反馈修改故事大纲。';
    const prompt = this.buildModificationDecisionPrompt({
      adaptability,
      currentRound,
      existingOutline,
      recentComments,
    });

    try {
      const response = await testModeSendChat(prompt, systemPrompt, 'inksurvivor-outline', authorToken);
      const decision = await parseLLMJsonWithRetry<OutlineModificationDecision>(
        () => Promise.resolve(response),
        {
          taskId: `OutlineDecision-${bookId}-round${currentRound}`,
          maxRetries: 2,
        }
      );

      console.log(`[Outline] 大纲修改判断结果: shouldModify=${decision.shouldModify}, targetChapters=${decision.targetChapters}, changes=${decision.changes.slice(0, 50)}...`);

      // 代码层面强制验证：过滤掉小于 currentRound 的章节（第N轮时第N-1章及之前已写完不能修改）
      if (decision.shouldModify && decision.targetChapters.length > 0) {
        const validChapters = decision.targetChapters.filter(ch => ch >= currentRound);
        if (validChapters.length !== decision.targetChapters.length) {
          console.log(`[Outline] 过滤掉小于第${currentRound}章的章节后，targetChapters: ${validChapters}`);
          decision.targetChapters = validChapters;
          if (validChapters.length === 0) {
            decision.shouldModify = false;
            decision.changes = '过滤后的目标章节为空，无法修改';
          }
        }
      }

      return decision;
    } catch (error) {
      console.error(`[Outline] 判断大纲修改失败，默认不修改:`, error);
      return {
        shouldModify: false,
        targetChapters: [],
        changes: '判断过程出错，暂不修改大纲',
      };
    }
  }

  /**
   * 构建大纲修改判断的 prompt
   */
  private buildModificationDecisionPrompt(params: {
    adaptability: number;
    currentRound: number;
    existingOutline: BookOutline | null;
    recentComments: Array<{ type: 'ai' | 'human'; content: string; rating?: number }>;
  }): string {
    const adaptabilityLevel = params.adaptability >= 0.7 ? '高度听劝' : params.adaptability >= 0.4 ? '中等听劝' : '固执己见';

    // 格式化评论
    const aiComments = params.recentComments.filter(c => c.type === 'ai').slice(0, 5);
    const humanComments = params.recentComments.filter(c => c.type === 'human').slice(0, 3);

    let outlineInfo = '';
    if (params.existingOutline) {
      // 输出完整的大纲详情
      const chaptersFullDetail = params.existingOutline.chapters.map(c => {
        return `### 第${c.number}章 "${c.title}"
- 概要：${c.summary}
- 关键事件：${c.key_events?.join('、') || '无'}
- 字数目标：${c.word_count_target || 2000}`;
      }).join('\n\n');

      outlineInfo = `
## 当前大纲
- 书名：${params.existingOutline.title}
- 主线：${params.existingOutline.summary}
- 章节数：${params.existingOutline.chapters.length} 章
- 关键人物：${params.existingOutline.characters.map(c => `${c.name}(${c.role}): ${c.description}`).join('；')}

## 各章节完整大纲

${chaptersFullDetail}
`;
    }

    return `## 任务
判断是否需要根据读者反馈修改故事大纲。

## 作者信息
- 听劝指数：${params.adaptability}（${adaptabilityLevel}）
- 当前轮次：第 ${params.currentRound} 轮

${outlineInfo}
## 读者反馈

### AI 读者评论（选 Top 5）
${aiComments.map((c, i) => `${i + 1}. ${c.content}${c.rating !== undefined ? `（评分: ${c.rating}/10）` : ''}`).join('\n')}

### 人类读者评论（选 Top 3）
${humanComments.length > 0 ? humanComments.map((c, i) => `${i + 1}. ${c.content}`).join('\n') : '暂无人类评论'}

## 修改规则
### 轮次限制（强制）
- **当前是第 ${params.currentRound} 轮**
- **只能修改第 ${params.currentRound} 章及之后的大纲**
- 第 ${params.currentRound - 1} 章及之前的章节已经写完，**绝对不能修改**

### 绝对不能修改
- 故事主线/主题
- 关键人物（名字、性格、核心设定）
- 章节总数

### 可以根据反馈调整
- 具体事件安排
- 章节的情节走向
- 配角命运/戏份
- 悬念设置

## 输出格式 (JSON)
{
  "shouldModify": true/false,
  "targetChapters": [2, 3],  // 需要修改的章节列表，空数组表示不修改
  "changes": "修改意见（一段话描述如何修改，如：'第二章增加女配角的戏份，第三章调整情节走向'）"
}

只输出 JSON，不要有其他内容。`;
  }

  /**
   * 根据反馈修改大纲
   * 只修改第 currentRound 章及以后的大纲，保留已完成的章节大纲
   */
  private async modifyOutline(
    bookId: string,
    currentRound: number,
    agentConfig: AgentConfig,
    existingOutline: BookOutline,
    decision: OutlineModificationDecision
  ): Promise<ChapterOutline[]> {
    console.log(`[Outline] 开始修改大纲，修改范围：第 ${currentRound} 章及以后`);

    // 获取赛季信息和作者信息
    const book = await prisma.book.findUnique({
      where: { id: bookId },
      include: {
        author: { select: { id: true, nickname: true } },
      },
    });
    if (!book?.seasonId) {
      throw new Error('书籍不存在或无赛季信息');
    }

    const season = await prisma.season.findUnique({ where: { id: book.seasonId } });
    if (!season) {
      throw new Error('赛季不存在');
    }

    // 获取作者的 token
    const authorToken = await getUserTokenById(book.author.id);
    if (!authorToken) {
      throw new Error(`无法获取作者 ${book.author.nickname} 的 Token`);
    }

    // 构建修改大纲的 prompt（包含完整 Agent 配置）
    const systemPrompt = buildAuthorSystemPrompt({
      userName: book.author.nickname || '作家',
      writerPersonality: agentConfig.writerPersonality || '',
      writingStyle: agentConfig.writingStyle || '多变',
      adaptability: agentConfig.adaptability ?? 0.5,
      preferredGenres: agentConfig.preferredGenres || [],
      seasonTheme: season.themeKeyword,
      constraints: season.constraints as unknown as string[],
      zoneStyle: this.normalizeZoneStyle(book.zoneStyle),
      wordCountTarget: agentConfig.wordCountTarget || 2000,
    });

    // 一次性修改所有目标章节
    // 代码层面强制过滤：只保留 >= currentRound 的章节
    const validTargetChapters = decision.targetChapters.filter(ch => ch >= currentRound);
    if (validTargetChapters.length === 0) {
      console.log(`[Outline] 没有可修改的目标章节（第${currentRound}轮只允许修改第${currentRound}章及之后）`);
      return [];
    }
    if (validTargetChapters.length !== decision.targetChapters.length) {
      console.log(`[Outline] 过滤后的目标章节: ${validTargetChapters}（原: ${decision.targetChapters}）`);
    }

    const prompt = this.buildModifyOutlinePrompt({
      currentRound,
      targetChapters: validTargetChapters,
      existingOutline,
      changes: decision.changes,
    });

    try {
      // 一次LLM调用返回多个章节
      interface MultiChapterResponse {
        chapters: Array<{
          number: number;
          title: string;
          summary: string;
          key_events?: string[];
          word_count_target?: number;
        }>;
      }

      const response = await testModeSendChat(prompt, systemPrompt, 'inksurvivor-outline', authorToken);
      const modifiedResult = await parseLLMJsonWithRetry<MultiChapterResponse>(
        () => Promise.resolve(response),
        {
          taskId: `OutlineModify-${bookId}-ch${decision.targetChapters.join('-')}`,
          maxRetries: 2,
        }
      );

      console.log(`[Outline] 多章节修改完成: ${modifiedResult.chapters.map(c => `第${c.number}章`).join(', ')}`);

      // 转换为ChapterOutline格式
      const modifiedChapters: ChapterOutline[] = modifiedResult.chapters.map(c => ({
        number: c.number,
        title: c.title,
        summary: c.summary,
        key_events: c.key_events || [],
        word_count_target: c.word_count_target || 2000,
      }));

      return modifiedChapters;
    } catch (error) {
      console.error(`[Outline] 大纲修改失败:`, error);
      throw error;
    }
  }

  /**
   * 构建大纲修改的 prompt（支持多章节）
   */
  private buildModifyOutlinePrompt(params: {
    currentRound: number;
    targetChapters: number[];
    existingOutline: BookOutline;
    changes: string;
  }): string {
    // 获取所有目标章节的当前大纲
    const targetChaptersOutlines = params.targetChapters.map(chNum => ({
      number: chNum,
      outline: params.existingOutline.chapters.find(c => c.number === chNum),
      prev: params.existingOutline.chapters.find(c => c.number === chNum - 1),
      next: params.existingOutline.chapters.find(c => c.number === chNum + 1),
    }));

    // 构建每个目标章节的上下文
    const chaptersContext = targetChaptersOutlines.map(t => {
      return `### 第 ${t.number} 章（待修改）
标题：${t.outline?.title || '无'}
概要：${t.outline?.summary || '无'}
关键事件：${t.outline?.key_events?.join(', ') || '无'}

**上一章** ${t.prev ? `"${t.prev.title}": ${t.prev.summary}` : '（无）'}
**下一章** ${t.next ? `"${t.next.title}": ${t.next.summary}` : '（无）'}`;
    }).join('\n\n');

    return `## 任务
根据读者反馈，同时修改以下章节的大纲：第 ${params.targetChapters.join('、')} 章。

## 修改原因
${params.changes}

## 修改约束
- **只能修改第 ${params.targetChapters.join('、')} 章的大纲**
- 其他章节的大纲必须保持原样
- 章节总数保持 ${params.existingOutline.chapters.length} 章不变

## 目标章节上下文

${chaptersContext}

## 关键人物（不能修改）
${params.existingOutline.characters.map(c => `- ${c.name}: ${c.description}`).join('\n')}

## 修改规则
1. **绝对不能修改**：人物、章节总数、已建立的背景设定
2. **可以调整**：该章节的情节走向、具体事件、悬念设置
3. 必须保持与上下文的连贯性

## 输出格式 (JSON)
同时输出所有修改后的章节大纲：
{
  "chapters": [
    { "number": ${params.targetChapters[0]}, "title": "新标题", "summary": "新概要", "key_events": ["事件1"], "word_count_target": 2000 },
    ...
  ]
}

只输出 JSON，不要有其他内容。`;
  }

  /**
   * 保存大纲版本到数据库
   */
  private async saveOutlineVersion(
    bookId: string,
    roundCreated: number,
    reason?: string
  ): Promise<number> {
    // 获取当前版本号
    const latestVersion = await prisma.bookOutlineVersion.findFirst({
      where: { bookId },
      orderBy: { version: 'desc' },
    });

    const newVersion = (latestVersion?.version ?? 0) + 1;

    // 获取当前 Book 的大纲
    const book = await prisma.book.findUnique({
      where: { id: bookId },
      select: { originalIntent: true, characters: true, chaptersPlan: true },
    });

    // 创建新版本
    await prisma.bookOutlineVersion.create({
      data: {
        bookId,
        version: newVersion,
        roundCreated,
        originalIntent: book?.originalIntent ?? null,
        characters: toJsonValue(book?.characters),
        chaptersPlan: toJsonValue(book?.chaptersPlan),
        reason: reason ?? null,
      },
    });

    console.log(`[Outline] 保存大纲版本 v${newVersion} - 轮次: ${roundCreated}, 原因: ${reason ?? '初始版本'}`);
    return newVersion;
  }

  /**
   * 获取最新大纲版本号
   */
  private async getLatestOutlineVersion(bookId: string): Promise<number> {
    const latestVersion = await prisma.bookOutlineVersion.findFirst({
      where: { bookId },
      orderBy: { version: 'desc' },
    });
    return latestVersion?.version ?? 0;
  }

  /**
   * 获取章节概要
   */
  private getChapterSummary(chapters: ChapterOutline[], chapterNumber: number): string {
    const chapter = chapters.find((c) => c.number === chapterNumber);
    return chapter?.summary || '';
  }

  /**
   * 构建单章大纲生成提示
   * 增加上一章详细内容用于保持连贯性
   */
  private buildSingleChapterPrompt(params: {
    bookTitle: string;
    chapterNumber: number;
    previousChapterSummary: string;      // 简略：章节标题列表
    previousChapterContent?: string;     // 新增：上一章正文摘要
    existingChapterOutline?: {           // 新增：当前章节已有的简要大纲
      title: string;
      summary: string;
    };
    feedbacks?: string[];
    isLastChapter: boolean;
  }): string {
    return `请为《${params.bookTitle}》第 ${params.chapterNumber} 章生成详细大纲。

## 前文回顾
${params.previousChapterContent || params.previousChapterSummary}

${params.existingChapterOutline ? `## 当前章节大纲（必须在此基础上优化，不能完全重写）
- 标题：${params.existingChapterOutline.title}
- 概要：${params.existingChapterOutline.summary}

**重要：只能在原大纲基础上进行微调优化，不能改变剧情走向、不能更换人物、不能改变章节主题。**` : ''}

${params.feedbacks && params.feedbacks.length > 0 ? `## 读者反馈（根据反馈调整细节，但不能偏离原大纲）
${params.feedbacks.map((f) => `- ${f}`).join('\n')}` : ''}

## 输出格式 (JSON)
{
  "number": ${params.chapterNumber},
  "title": "章节标题（简洁有力，不超过10字）",
  "summary": "章节概要（100-150字）",
  "key_events": ["关键事件1", "关键事件2"],
  "word_count_target": 2000
}

${params.isLastChapter ? '注意：这是最后一章，需要有完结感。' : '注意：结尾需要留有悬念。'}

现在开始创作，只输出 JSON，不要有其他内容。`;
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

export const outlineGenerationService = new OutlineGenerationService();
