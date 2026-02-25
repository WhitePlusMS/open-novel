/**
 * 章节创作服务
 *
 * WRITING 阶段：为书籍创作章节正文
 * 基于大纲和读者反馈生成个性化章节内容
 */

import { prisma } from '@/lib/prisma';
import { wsEvents } from '@/lib/websocket/events';
import { outlineGenerationService } from './outline-generation.service';
import { readerAgentService } from './reader-agent.service';
import { taskQueueService } from './task-queue.service';
import { buildRoundGapsFromBooks } from '@/lib/utils/round-gap';
import {
  buildChapterSnapshotForBook,
  buildChapterSnapshots,
  prepareChapterGeneration,
  generateChapterContent,
  getDbConcurrency,
  getLlmConcurrency,
  runWithConcurrency,
  type PreparedChapterGeneration,
  type GeneratedChapter,
} from '@/lib/chapter-utils';

interface ChapterWriteJob {
  prepared: PreparedChapterGeneration;
  chapterData: GeneratedChapter;
}

export class ChapterWritingService {
  /**
   * 为单本书创作章节
   */
  async writeChapter(bookId: string, chapterNumber: number): Promise<void> {
    console.log(`[Chapter] 开始创作章节: bookId=${bookId}, chapter=${chapterNumber}`);

    const snapshot = await buildChapterSnapshotForBook(bookId, chapterNumber);
    if (!snapshot) return;

    const prepared = await prepareChapterGeneration(snapshot);
    if (!prepared) return;

    const chapterData = await generateChapterContent(prepared);
    const persisted = await this.persistGeneratedChapter(prepared, chapterData);
    await readerAgentService.batchDispatchReaderAgents([persisted]);
  }

  /**
   * 为赛季中所有需要创作章节的书籍创作章节
   */
  async writeChaptersForSeason(
    seasonId: string,
    chapterNumber: number,
    bookIds?: string[]
  ): Promise<void> {
    console.log(`[Chapter] 开始赛季章节创作: seasonId=${seasonId}, chapter=${chapterNumber}`);

    const snapshots = await buildChapterSnapshots(seasonId, chapterNumber, bookIds);
    console.log(`[Chapter] 需要创作章节的书籍数量: ${snapshots.length}`);

    const dbConcurrency = getDbConcurrency();
    const llmConcurrency = getLlmConcurrency();
    const preparedJobs: PreparedChapterGeneration[] = [];

    // 1) 读库准备阶段
    await runWithConcurrency(snapshots, dbConcurrency, async (snapshot) => {
      const prepared = await prepareChapterGeneration(snapshot);
      if (prepared) preparedJobs.push(prepared);
    });

    // 2) 模型生成阶段
    const generatedJobs: ChapterWriteJob[] = [];
    await runWithConcurrency(preparedJobs, llmConcurrency, async (prepared) => {
      const chapterData = await generateChapterContent(prepared).catch(error => {
        console.error(`[Chapter] 章节生成失败: bookId=${prepared.bookId}`, error);
        return null;
      });
      if (chapterData) generatedJobs.push({ prepared, chapterData });
    });

    // 3) 写库阶段
    const persistedChapters: Array<{ chapterId: string; bookId: string; chapterNumber: number; title: string }> = [];
    await runWithConcurrency(generatedJobs, dbConcurrency, async (job) => {
      const persisted = await this.persistGeneratedChapter(job.prepared, job.chapterData).catch(error => {
        console.error(`[Chapter] 章节发布失败: bookId=${job.prepared.bookId}`, error);
        return null;
      });
      if (persisted) persistedChapters.push(persisted);
    });

    await readerAgentService.batchDispatchReaderAgents(persistedChapters.map(item => ({
      chapterId: item.chapterId,
      bookId: item.bookId,
      chapterNumber: item.chapterNumber,
    })));

    console.log(`[Chapter] 赛季章节创作完成: publishedCount=${persistedChapters.length}`);
  }

  /**
   * 追赶模式：为落后书籍补齐缺失章节
   */
  async catchUpBooks(seasonId: string, targetRound: number): Promise<void> {
    console.log(`[CatchUp] 开始追赶模式: seasonId=${seasonId}, targetRound=${targetRound}`);

    const allBooks = await prisma.book.findMany({
      where: { seasonId, status: 'ACTIVE' },
      include: {
        _count: { select: { chapters: true } },
        chapters: { select: { chapterNumber: true } },
        author: { select: { agentConfig: true } },
      },
    });

    const books = allBooks.filter(book => book._count.chapters < targetRound);
    if (books.length === 0) {
      console.log(`[CatchUp] 没有需要追赶的书籍`);
      return;
    }

    console.log(`[CatchUp] 需要追赶的书籍数量: ${books.length}`);

    const missingChaptersByBook = new Map<string, number[]>();
    const missingByRound = new Map<number, string[]>();

    books.forEach(book => {
      const existingChapterNumbers = new Set(book.chapters.map(c => c.chapterNumber));
      const missingChapters: number[] = [];
      for (let i = 1; i <= targetRound; i++) {
        if (!existingChapterNumbers.has(i)) {
          missingChapters.push(i);
        }
      }
      if (missingChapters.length > 0) {
        missingChaptersByBook.set(book.id, missingChapters);
        missingChapters.forEach(chapterNum => {
          const list = missingByRound.get(chapterNum) ?? [];
          if (!list.includes(book.id)) list.push(book.id);
          missingByRound.set(chapterNum, list);
        });
      }
    });

    if (missingChaptersByBook.size === 0) return;

    // 生成缺失的大纲
    const booksWithoutOutline = books.filter((book) => !book.chaptersPlan);
    if (booksWithoutOutline.length > 0) {
      const llmConcurrency = getLlmConcurrency();
      await runWithConcurrency(booksWithoutOutline, llmConcurrency, async (book) => {
        await outlineGenerationService.generateOutline(book.id).catch(error => {
          console.error(`[CatchUp] 书籍《${book.title}》大纲生成失败:`, error);
        });
      });
    }

    // 按轮次生成大纲
    const needOutlineByRound = new Map<number, string[]>();
    missingChaptersByBook.forEach((missingChapters, bookId) => {
      const book = books.find(b => b.id === bookId);
      const chaptersPlan = (book?.chaptersPlan as unknown as Array<{ number: number }>) || [];
      const outlineChapterNumbers = new Set(chaptersPlan.map(c => c.number));
      missingChapters.forEach(chapterNum => {
        if (!outlineChapterNumbers.has(chapterNum)) {
          const list = needOutlineByRound.get(chapterNum) ?? [];
          if (!list.includes(bookId)) list.push(bookId);
          needOutlineByRound.set(chapterNum, list);
        }
      });
    });

    const outlineRounds = Array.from(needOutlineByRound.keys()).sort((a, b) => a - b);
    for (const chapterNum of outlineRounds) {
      const bookIds = needOutlineByRound.get(chapterNum) ?? [];
      if (bookIds.length > 0) {
        await outlineGenerationService.generateNextChapterOutlinesForBooks(bookIds, chapterNum);
      }
    }

    // 按轮次写章节
    const writeRounds = Array.from(missingByRound.keys()).sort((a, b) => a - b);
    for (const chapterNum of writeRounds) {
      const bookIds = missingByRound.get(chapterNum) ?? [];
      if (bookIds.length > 0) {
        await this.writeChaptersForSeason(seasonId, chapterNum, bookIds);
      }
    }

    console.log(`[CatchUp] 追赶模式完成`);
  }

  /**
   * 检测轮次间隙
   */
  async detectRoundGaps(
    seasonId: string,
    round: number
  ): Promise<Array<{ bookId: string; chapterNumber: number; gapType: 'OUTLINE' | 'CHAPTER' }>> {
    const books = await prisma.book.findMany({
      where: { seasonId, status: 'ACTIVE' },
      select: {
        id: true,
        chapters: { select: { chapterNumber: true } },
        chaptersPlan: true,
      },
    });
    return buildRoundGapsFromBooks(books, round);
  }

  /**
   * 记录轮次间隙
   */
  async recordRoundGaps(seasonId: string, round: number, source: string): Promise<void> {
    const gaps = await this.detectRoundGaps(seasonId, round);
    if (gaps.length === 0) {
      await prisma.seasonRound.upsert({
        where: { seasonId_round: { seasonId, round } },
        update: { gapCheckStatus: 'DONE' },
        create: { seasonId, round, gapCheckStatus: 'DONE' },
      });
      return;
    }

    await prisma.roundGap.createMany({
      data: gaps.map(gap => ({
        seasonId,
        round,
        bookId: gap.bookId,
        chapterNumber: gap.chapterNumber,
        gapType: gap.gapType,
        status: 'OPEN',
        source,
      })),
      skipDuplicates: true,
    });

    await prisma.seasonRound.upsert({
      where: { seasonId_round: { seasonId, round } },
      update: { gapCheckStatus: 'DONE' },
      create: { seasonId, round, gapCheckStatus: 'DONE' },
    });
  }

  /**
   * 解决轮次间隙
   */
  async resolveRoundGaps(seasonId: string, round: number): Promise<void> {
    const openGaps = await prisma.roundGap.findMany({
      where: { seasonId, round, status: 'OPEN' },
      select: { id: true, bookId: true, chapterNumber: true, gapType: true },
    });

    if (openGaps.length === 0) return;

    const outlineByRound = new Map<number, string[]>();
    const chapterByRound = new Map<number, string[]>();

    openGaps.forEach(gap => {
      const mapTarget = gap.gapType === 'OUTLINE' ? outlineByRound : chapterByRound;
      const list = mapTarget.get(gap.chapterNumber) ?? [];
      if (!list.includes(gap.bookId)) list.push(gap.bookId);
      mapTarget.set(gap.chapterNumber, list);
    });

    // 生成缺失大纲
    const outlineRounds = Array.from(outlineByRound.keys()).sort((a, b) => a - b);
    for (const chapterNum of outlineRounds) {
      const bookIds = outlineByRound.get(chapterNum) ?? [];
      if (bookIds.length > 0) {
        await outlineGenerationService.generateNextChapterOutlinesForBooks(bookIds, chapterNum);
      }
    }

    // 补写缺失章节
    const writeRounds = Array.from(chapterByRound.keys()).sort((a, b) => a - b);
    for (const chapterNum of writeRounds) {
      const bookIds = chapterByRound.get(chapterNum) ?? [];
      if (bookIds.length > 0) {
        await this.writeChaptersForSeason(seasonId, chapterNum, bookIds);
      }
    }

    // 更新间隙状态
    const remainingGaps = await this.detectRoundGaps(seasonId, round);
    const remainingSet = new Set(remainingGaps.map(gap => `${gap.bookId}:${gap.chapterNumber}:${gap.gapType}`));
    const resolvedIds = openGaps
      .filter(gap => !remainingSet.has(`${gap.bookId}:${gap.chapterNumber}:${gap.gapType}`))
      .map(gap => gap.id);

    if (resolvedIds.length > 0) {
      await prisma.roundGap.updateMany({
        where: { id: { in: resolvedIds } },
        data: { status: 'RESOLVED', resolvedAt: new Date() },
      });
    }
  }

  /**
   * 单本书的章节补全
   */
  async catchUpSingleBook(bookId: string, targetRound: number): Promise<void> {
    console.log(`[CatchUpSingle] 开始为书籍 ${bookId} 补全章节，目标轮次: ${targetRound}`);

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

    // 生成大纲
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
    const outlineChapterNumbers = new Set(chaptersPlan.map(c => c.number));
    const maxOutlineChapter = Math.max(...Array.from(outlineChapterNumbers), 0);

    // 计算缺失章节
    const existingChapterNumbers = new Set(book.chapters.map(c => c.chapterNumber));
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

    // 生成缺失的大纲
    const needGenerateOutline: number[] = [];
    for (const ch of missingChapters) {
      if (!outlineChapterNumbers.has(ch)) {
        needGenerateOutline.push(ch);
      }
    }

    if (needGenerateOutline.length > 0) {
      console.log(`[CatchUpSingle] 需要生成大纲的章节: ${needGenerateOutline.join(', ')}`);
      await outlineGenerationService.generateNextChapterOutlinesForBooks([bookId], targetRound);
    }

    // 补写缺失章节
    for (const chapterNum of missingChapters) {
      console.log(`[CatchUpSingle] 补写第 ${chapterNum} 章`);
      await this.writeChapter(bookId, chapterNum);
    }

    console.log(`[CatchUpSingle] 书籍《${book.title}》章节补全完成`);
  }

  /**
   * 持久化章节到数据库
   */
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
          console.log(`[Chapter] 章节已存在，跳过写入: bookId=${prepared.bookId}, chapter=${prepared.chapterNumber}`);
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

    // 更新书籍状态
    const bookSnapshot = await prisma.book.findUnique({
      where: { id: prepared.bookId },
      select: {
        seasonId: true,
        plannedChapters: true,
        chaptersPlan: true,
        chapters: { select: { chapterNumber: true } },
      },
    });

    const existingChapterNumbers = new Set(
      (bookSnapshot?.chapters || []).map(chapter => chapter.chapterNumber)
    );
    const outlineNumbers = Array.isArray(bookSnapshot?.chaptersPlan)
      ? (bookSnapshot?.chaptersPlan as Array<{ number?: number }>).map(item => item.number).filter((num): num is number => Number.isFinite(num))
      : [];
    const plannedCount = bookSnapshot?.plannedChapters && bookSnapshot.plannedChapters > 0
      ? bookSnapshot.plannedChapters
      : 0;
    const expectedNumbers = plannedCount > 0
      ? Array.from({ length: plannedCount }, (_, idx) => idx + 1)
      : outlineNumbers.length > 0
        ? outlineNumbers
        : [];
    const hasOutlineGaps = expectedNumbers.some(num => !existingChapterNumbers.has(num));

    const isCompleted = prepared.chapterNumber >= prepared.bookMaxChapters && !hasOutlineGaps;

    await prisma.book.update({
      where: { id: prepared.bookId },
      data: {
        currentChapter: prepared.chapterNumber,
        status: isCompleted ? 'COMPLETED' : 'ACTIVE',
        heatValue: { increment: 100 },
        finalScore: { increment: 100 + Math.floor(Math.random() * 50) },
        viewCount: { increment: Math.floor(Math.random() * 50) },
      },
    });

    if (isCompleted) {
      console.log(`[Chapter] 书籍已完成全部章节: bookId=${prepared.bookId}`);
    } else if (hasOutlineGaps) {
      const seasonId = bookSnapshot?.seasonId;
      if (seasonId) {
        const season = await prisma.season.findUnique({
          where: { id: seasonId },
          select: { currentRound: true },
        });
        const round = season?.currentRound || prepared.chapterNumber;
        await taskQueueService.create({
          taskType: 'CATCH_UP',
          payload: { seasonId, round },
          priority: 9,
        });
      }
    }

    // 通知前端
    wsEvents.chapterPublished(prepared.bookId, newChapter.chapterNumber, newChapter.title);

    return {
      chapterId: newChapter.id,
      bookId: prepared.bookId,
      chapterNumber: prepared.chapterNumber,
      title: newChapter.title,
    };
  }
}

export const chapterWritingService = new ChapterWritingService();
