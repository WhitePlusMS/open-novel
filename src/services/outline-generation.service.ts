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
import { BookOutline, ChapterPlan, Character } from '@/types/outline';
import {
  getDbConcurrency,
  getLlmConcurrency,
  runWithConcurrency,
  buildOutlineSnapshots,
  buildOutlineSnapshotForBook,
  buildNextOutlineSnapshots,
  saveOutlineVersion,
} from '@/lib/outline-utils';
import { buildModificationDecisionPrompt, buildModifyOutlinePrompt, normalizeZoneStyle } from '@/lib/outline-prompt-builder';

// Agent 配置接口
interface AgentConfig {
  writerPersonality: string;
  selfIntro?: string;
  interestTags?: string[];
  writingStyle: string;
  writingLengthPreference: 'short' | 'medium' | 'long';
  adaptability: number;
  preferredGenres: string[];
  wordCountTarget: number;
}

// 单章大纲数据结构
interface ChapterOutline {
  number: number;
  title: string;
  summary: string;
  key_events: string[];
  word_count_target: number;
}

// 大纲修改判断结果
interface OutlineModificationDecision {
  shouldModify: boolean;
  targetChapters: number[];
  changes: string;
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

interface OutlineWriteJob {
  bookId: string;
  outlineData: BookOutline;
  roundCreated: number;
  reason: string;
}

export class OutlineGenerationService {
  /**
   * 为单本书生成大纲
   */
  async generateOutline(bookId: string, testMode: boolean = false): Promise<{
    title: string;
    summary: string;
    characters: unknown[];
    chapters: unknown[];
  } | null> {
    console.log(`[Outline] 开始为书籍 ${bookId} 生成大纲${testMode ? ' (测试模式)' : ''}`);
    const snapshot = await buildOutlineSnapshotForBook(bookId);
    if (!snapshot) return null;

    const prepared = await this.prepareOutlineGeneration(snapshot, testMode);
    if (!prepared) return null;

    const outlineData = await this.generateOutlineContent(prepared);
    const result = await this.persistOutline(prepared, outlineData);

    if (result && 'outlineData' in result) {
      await this.persistOutlineBatch([result]);
      return null;
    }
    return result;
  }

  /**
   * 为单本书生成下一章大纲
   */
  async generateNextChapterOutline(
    bookId: string,
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
    console.log(`[Outline] 开始为书籍 ${bookId} 生成下一章大纲${testMode ? ' (测试模式)' : ''}`);
    const snapshots = await buildNextOutlineSnapshots([bookId], targetRound);
    const snapshot = snapshots[0];
    if (!snapshot) {
      console.error(`[Outline] 书籍不存在: ${bookId}`);
      return null;
    }
    return this.generateNextChapterOutlineFromSnapshot(snapshot, targetRound, testMode, testComments);
  }

  private async generateNextChapterOutlineFromSnapshot(
    snapshot: {
      bookId: string;
      bookTitle: string;
      currentChapterCount: number;
      nextChapterNumber: number;
      chaptersPlan: unknown;
      originalIntent: string | null;
      characters: unknown;
      comments: Array<{ type: 'ai' | 'human'; content: string; rating?: number }>;
      authorAgentConfig: Record<string, unknown>;
      seasonTheme: string;
      seasonConstraints: string[];
      seasonMaxChapters: number;
      seasonMinChapters: number;
      zoneStyle: string;
    },
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

    if (!snapshot.chaptersPlan) {
      await this.generateOutline(bookId);
      return null;
    }

    const chaptersPlan = snapshot.chaptersPlan as ChapterPlan[] | null;
    if (!chaptersPlan || snapshot.nextChapterNumber > chaptersPlan.length) {
      console.log(`[Outline] 书籍《${snapshot.bookTitle}》已完成所有 ${chaptersPlan?.length ?? 0} 章，跳过大纲生成`);
      return null;
    }

    const agentConfig: AgentConfig = snapshot.authorAgentConfig as unknown as AgentConfig;
    const existingChapterOutline = chaptersPlan.find((c) => c.number === snapshot.nextChapterNumber);
    if (existingChapterOutline && !testMode) {
      console.log(`[Outline] 第 ${snapshot.nextChapterNumber} 章大纲已存在`);
      return null;
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
      characters: (snapshot.characters as Character[]) || [],
      chapters: chaptersPlan,
      themes: [],
      tone: '',
    };

    const adaptability = agentConfig.adaptability ?? 0.5;
    const adaptabilityThreshold = 0.35;
    if (adaptability < adaptabilityThreshold) {
      console.log(`[Outline] 听劝指数 ${adaptability} < ${adaptabilityThreshold}，固执己见，直接返回原大纲`);
      return {
        title: snapshot.bookTitle,
        summary: snapshot.originalIntent || '',
        characters: (snapshot.characters as Character[]) || [],
        chapters: chaptersPlan,
        originalChapters: chaptersPlan,
      };
    }

    const decision = await this.shouldModifyOutline(
      bookId,
      snapshot.nextChapterNumber,
      adaptability,
      bookOutline,
      allComments
    );

    let updatedChapters = chaptersPlan;
    if (decision.shouldModify && decision.targetChapters.length > 0) {
      console.log(`[Outline] 判断需要修改大纲，targetChapters: ${decision.targetChapters}`);

      try {
        const modifiedChapters = await this.modifyOutline(
          bookId,
          snapshot.nextChapterNumber,
          agentConfig,
          bookOutline,
          decision
        );

        const targetSet = new Set(decision.targetChapters);
        const otherChapters = chaptersPlan.filter(c => !targetSet.has(c.number));
        updatedChapters = [...otherChapters, ...modifiedChapters].sort((a, b) => a.number - b.number);

        return {
          title: snapshot.bookTitle,
          summary: snapshot.originalIntent || '',
          characters: (snapshot.characters as Character[]) || [],
          chapters: updatedChapters,
          originalChapters: chaptersPlan,
        };
      } catch (error) {
        console.error(`[Outline] 大纲修改失败:`, error);
      }
    }

    return {
      title: snapshot.bookTitle,
      summary: snapshot.originalIntent || '',
      characters: (snapshot.characters as Character[]) || [],
      chapters: chaptersPlan,
      originalChapters: chaptersPlan,
    };
  }

  /**
   * 为赛季中所有活跃书籍生成下一章大纲
   */
  async generateOutlinesForSeason(seasonId: string): Promise<void> {
    console.log(`[Outline] 开始为赛季 ${seasonId} 生成下一章大纲`);

    const snapshots = await buildOutlineSnapshots(seasonId);
    console.log(`[Outline] 发现 ${snapshots.length} 本活跃书籍`);

    const booksNeedingOutline = snapshots.filter((b) => b.chaptersCount === 0);
    if (booksNeedingOutline.length === 0) {
      console.log(`[Outline] 所有书籍已有大纲`);
      return;
    }

    console.log(`[Outline] 需要生成大纲的书籍: ${booksNeedingOutline.length} 本`);

    const dbConcurrency = getDbConcurrency();
    const llmConcurrency = getLlmConcurrency();
    const preparedJobs: PreparedOutlineGeneration[] = [];

    await runWithConcurrency(booksNeedingOutline, dbConcurrency, async (snapshot) => {
      const prepared = await this.prepareOutlineGeneration(snapshot, false).catch((error) => {
        console.error(`[Outline] 书籍《${snapshot.bookTitle}》大纲准备失败:`, error);
        return null;
      });
      if (prepared) preparedJobs.push(prepared);
    });

    const generatedJobs: Array<{ prepared: PreparedOutlineGeneration; outlineData: BookOutline }> = [];
    await runWithConcurrency(preparedJobs, llmConcurrency, async (prepared) => {
      const outlineData = await this.generateOutlineContent(prepared).catch((error) => {
        console.error(`[Outline] 书籍《${prepared.bookTitle}》大纲生成失败:`, error);
        return null;
      });
      if (outlineData) generatedJobs.push({ prepared, outlineData });
    });

    const writeJobs: OutlineWriteJob[] = [];
    await runWithConcurrency(generatedJobs, dbConcurrency, async (job) => {
      const result = await this.persistOutline(job.prepared, job.outlineData).catch((error) => {
        console.error(`[Outline] 书籍《${job.prepared.bookTitle}》大纲写入失败:`, error);
        return null;
      });
      if (result && 'outlineData' in result) writeJobs.push(result);
    });

    await this.persistOutlineBatch(writeJobs);
    console.log(`[Outline] 赛季 ${seasonId} 大纲生成完成`);
  }

  /**
   * 为多本书生成下一章大纲
   */
  async generateNextChapterOutlinesForBooks(bookIds: string[], targetRound?: number): Promise<void> {
    const snapshots = await buildNextOutlineSnapshots(bookIds, targetRound);
    if (snapshots.length === 0) {
      console.log('[Outline] 没有需要生成下一章大纲的书籍');
      return;
    }
    const llmConcurrency = getLlmConcurrency();
    await runWithConcurrency(snapshots, llmConcurrency, async (snapshot) => {
      await this.generateNextChapterOutlineFromSnapshot(snapshot, targetRound, false).catch((error) => {
        console.error(`[Outline] 书籍《${snapshot.bookTitle}》下一章大纲生成失败:`, error);
      });
    });
  }

  private async prepareOutlineGeneration(
    snapshot: {
      bookId: string;
      bookTitle: string;
      authorId: string;
      authorNickname: string;
      authorAgentConfig: Record<string, unknown>;
      seasonTheme: string;
      seasonConstraints: string[];
      seasonMaxChapters: number;
      seasonMinChapters: number;
      zoneStyle: string;
      chaptersPlan: unknown | null;
    },
    testMode: boolean
  ): Promise<PreparedOutlineGeneration | null> {
    if (!testMode && snapshot.chaptersPlan) {
      console.log(`[Outline] 书籍《${snapshot.bookTitle}》已有大纲，跳过生成`);
      return null;
    }

    const rawConfig = snapshot.authorAgentConfig;
    const agentConfig: AgentConfig = {
      writerPersonality: (rawConfig.writerPersonality as string) || '',
      writingStyle: (rawConfig.writingStyle as string) || '多变',
      writingLengthPreference: (rawConfig.writingLengthPreference as 'short' | 'medium' | 'long') || 'medium',
      adaptability: (rawConfig.adaptability as number) ?? 0.5,
      preferredGenres: (rawConfig.preferredGenres as string[]) || [],
      wordCountTarget: (rawConfig.wordCountTarget as number) || 2000,
    };

    const chapterPreferenceText = agentConfig.writingLengthPreference === 'short'
      ? '短篇小说风格（精简干练，节奏快）'
      : agentConfig.writingLengthPreference === 'long'
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
      zoneStyle: normalizeZoneStyle(snapshot.zoneStyle),
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
      zoneStyle: normalizeZoneStyle(snapshot.zoneStyle),
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
    const dbConcurrency = getDbConcurrency();
    console.log(`[Outline][Supabase][写] 批量写入 ${jobs.length} 本书大纲, 并发=${dbConcurrency}`);

    await runWithConcurrency(jobs, dbConcurrency, async (job) => {
      const chapters = Array.isArray(job.outlineData.chapters) ? job.outlineData.chapters : [];
      if (chapters.length === 0) {
        console.warn(`[Outline] 大纲缺少章节数据，跳过保存: bookId=${job.bookId}`);
        return;
      }
      const characters = Array.isArray(job.outlineData.characters) ? job.outlineData.characters : [];

      await prisma.book.update({
        where: { id: job.bookId },
        data: {
          originalIntent: job.outlineData.summary,
          chaptersPlan: toJsonValue(chapters),
          characters: toJsonValue(characters),
          plannedChapters: chapters.length,
        },
      });

      await saveOutlineVersion(job.bookId, job.roundCreated, job.reason);
      console.log(`[Outline] 书籍 ${job.bookId} 大纲生成完成 - ${chapters.length} 章`);
    });
  }

  private async shouldModifyOutline(
    bookId: string,
    currentRound: number,
    adaptability: number,
    existingOutline: BookOutline | null,
    recentComments: Array<{ type: 'ai' | 'human'; content: string; rating?: number }>
  ): Promise<OutlineModificationDecision> {
    console.log(`[Outline] 判断是否需要修改大纲 - adaptability: ${adaptability}, 评论数: ${recentComments.length}`);

    if (recentComments.length === 0) {
      return { shouldModify: false, targetChapters: [], changes: '暂无读者反馈' };
    }

    const book = await prisma.book.findUnique({
      where: { id: bookId },
      include: { author: { select: { id: true, nickname: true } } },
    });
    if (!book) {
      return { shouldModify: false, targetChapters: [], changes: '书籍不存在' };
    }

    const authorToken = await getUserTokenById(book.author.id);
    if (!authorToken) {
      return { shouldModify: false, targetChapters: [], changes: '无法获取 Token' };
    }

    const systemPrompt = '你是本书的作者，你需要判断是否需要根据读者反馈修改故事大纲。';
    const prompt = buildModificationDecisionPrompt({
      adaptability,
      currentRound,
      existingOutline,
      recentComments,
    });

    try {
      const response = await testModeSendChat(prompt, systemPrompt, 'inksurvivor-outline', authorToken);
      const decision = await parseLLMJsonWithRetry<OutlineModificationDecision>(
        () => Promise.resolve(response),
        { taskId: `OutlineDecision-${bookId}-r${currentRound}`, maxRetries: 2 }
      );

      if (decision.shouldModify && decision.targetChapters.length > 0) {
        const validChapters = decision.targetChapters.filter(ch => ch >= currentRound);
        if (validChapters.length === 0) {
          decision.shouldModify = false;
          decision.changes = '过滤后的目标章节为空';
        } else {
          decision.targetChapters = validChapters;
        }
      }

      return decision;
    } catch (error) {
      console.error(`[Outline] 判断大纲修改失败:`, error);
      return { shouldModify: false, targetChapters: [], changes: '判断过程出错' };
    }
  }

  private async modifyOutline(
    bookId: string,
    currentRound: number,
    agentConfig: AgentConfig,
    existingOutline: BookOutline,
    decision: OutlineModificationDecision
  ): Promise<ChapterOutline[]> {
    const book = await prisma.book.findUnique({
      where: { id: bookId },
      include: { author: { select: { id: true, nickname: true } } },
    });
    if (!book?.seasonId) throw new Error('书籍不存在或无赛季信息');

    const season = await prisma.season.findUnique({ where: { id: book.seasonId } });
    if (!season) throw new Error('赛季不存在');

    const authorToken = await getUserTokenById(book.author.id);
    if (!authorToken) throw new Error(`无法获取作者 Token`);

    const systemPrompt = buildAuthorSystemPrompt({
      userName: book.author.nickname || '作家',
      writerPersonality: agentConfig.writerPersonality || '',
      writingStyle: agentConfig.writingStyle || '多变',
      adaptability: agentConfig.adaptability ?? 0.5,
      preferredGenres: agentConfig.preferredGenres || [],
      seasonTheme: season.themeKeyword,
      constraints: season.constraints as unknown as string[],
      zoneStyle: normalizeZoneStyle(book.zoneStyle),
      wordCountTarget: agentConfig.wordCountTarget || 2000,
    });

    const validTargetChapters = decision.targetChapters.filter(ch => ch >= currentRound);
    if (validTargetChapters.length === 0) return [];

    const prompt = buildModifyOutlinePrompt({
      currentRound,
      targetChapters: validTargetChapters,
      existingOutline,
      changes: decision.changes,
    });

    try {
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
        { taskId: `OutlineModify-${bookId}`, maxRetries: 2 }
      );

      return modifiedResult.chapters.map(c => ({
        number: c.number,
        title: c.title,
        summary: c.summary,
        key_events: c.key_events || [],
        word_count_target: c.word_count_target || 2000,
      }));
    } catch (error) {
      console.error(`[Outline] 大纲修改失败:`, error);
      throw error;
    }
  }
}

export const outlineGenerationService = new OutlineGenerationService();
