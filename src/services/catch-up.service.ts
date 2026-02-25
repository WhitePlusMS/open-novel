/**
 * 章节追赶服务
 *
 * 处理书籍章节追赶相关逻辑
 */

import { prisma } from '@/lib/prisma';
import { chapterWritingService } from './chapter-writing.service';

/**
 * 追赶状态
 */
export interface CatchUpStatus {
  hasOutline: boolean;
  outlineChapters: number[];
  existingChapters: number[];
  missingChapters: number[];
  targetRound: number;
  maxOutlineChapter: number;
  needsCatchUp: boolean;
}

/**
 * 获取单本书籍的追赶状态
 */
export async function getCatchUpStatus(bookId: string): Promise<CatchUpStatus> {
  const book = await prisma.book.findUnique({
    where: { id: bookId },
    include: {
      chapters: { select: { chapterNumber: true }, orderBy: { chapterNumber: 'asc' } },
      season: { select: { currentRound: true } },
    },
  });

  if (!book) {
    throw new Error('书籍不存在');
  }

  const season = await prisma.season.findFirst({
    where: { status: 'ACTIVE' },
    orderBy: { startTime: 'desc' },
  });

  const targetRound = season?.currentRound || 1;

  // 解析大纲
  let outlineChapters: number[] = [];
  if (book.chaptersPlan) {
    const chaptersPlan = book.chaptersPlan as Array<{ number: number }>;
    outlineChapters = chaptersPlan.map(c => c.number);
  }

  const existingChapters = book.chapters.map(c => c.chapterNumber);

  // 计算缺失章节
  const missingChapters: number[] = [];
  const maxChapter = Math.max(targetRound, ...outlineChapters, 0);
  for (let i = 1; i <= maxChapter; i++) {
    if (!existingChapters.includes(i)) {
      missingChapters.push(i);
    }
  }

  return {
    hasOutline: !!book.chaptersPlan,
    outlineChapters,
    existingChapters,
    missingChapters,
    targetRound,
    maxOutlineChapter: Math.max(...outlineChapters, 0),
    needsCatchUp: missingChapters.length > 0,
  };
}

/**
 * 执行单本书籍的追赶
 */
export async function executeCatchUp(bookId: string, targetRound: number): Promise<{
  success: boolean;
  message: string;
  missingChapters: number[];
}> {
  const status = await getCatchUpStatus(bookId);

  if (!status.hasOutline) {
    return {
      success: false,
      message: '该书还没有大纲，无法补全章节',
      missingChapters: [],
    };
  }

  if (!status.needsCatchUp) {
    return {
      success: true,
      message: '章节已完整，无需补全',
      missingChapters: [],
    };
  }

  // 异步执行补全
  setTimeout(async () => {
    try {
      await chapterWritingService.catchUpSingleBook(bookId, targetRound);
    } catch (error) {
      console.error(`[CatchUp] 书籍补全失败:`, error);
    }
  }, 100);

  return {
    success: true,
    message: `正在补全 ${status.missingChapters.length} 个缺失章节`,
    missingChapters: status.missingChapters,
  };
}

/**
 * 缺口信息
 */
export interface GapInfo {
  id: string;
  title: string;
  author: string;
  chapterGaps: number[];
  outlineGaps: number[];
}

/**
 * 获取当前赛季的追赶状态
 */
export async function getSeasonCatchUpStatus() {
  const season = await prisma.season.findFirst({
    where: { status: 'ACTIVE' },
    orderBy: { startTime: 'desc' },
  });

  if (!season) {
    return null;
  }

  const currentRound = season.currentRound || 1;

  const gaps = await prisma.roundGap.findMany({
    where: {
      seasonId: season.id,
      round: currentRound,
      status: 'OPEN',
    },
    include: {
      book: {
        select: {
          id: true,
          title: true,
          author: { select: { nickname: true } },
        },
      },
    },
  });

  const gapByBook = new Map<string, GapInfo>();

  for (const gap of gaps) {
    const existing = gapByBook.get(gap.bookId) ?? {
      id: gap.bookId,
      title: gap.book.title,
      author: gap.book.author.nickname,
      chapterGaps: [] as number[],
      outlineGaps: [] as number[],
    };

    if (gap.gapType === 'CHAPTER') {
      existing.chapterGaps.push(gap.chapterNumber);
    } else {
      existing.outlineGaps.push(gap.chapterNumber);
    }

    gapByBook.set(gap.bookId, existing);
  }

  const gapDetails: GapInfo[] = Array.from(gapByBook.values()).map(item => ({
    ...item,
    chapterGaps: Array.from(new Set(item.chapterGaps)).sort((a, b) => a - b),
    outlineGaps: Array.from(new Set(item.outlineGaps)).sort((a, b) => a - b),
  }));

  return {
    seasonId: season.id,
    seasonNumber: season.seasonNumber,
    currentRound,
    gapCount: gaps.length,
    gapBooks: gapDetails.length,
    gapDetails,
  };
}

/**
 * 执行赛季追赶
 */
export async function executeSeasonCatchUp(targetRound?: number) {
  const season = await prisma.season.findFirst({
    where: { status: 'ACTIVE' },
    orderBy: { startTime: 'desc' },
  });

  if (!season) {
    throw new Error('没有正在进行的赛季');
  }

  const currentRound = season.currentRound || 1;
  const round = targetRound || currentRound;

  console.log(`[CatchUp API] 收到追赶请求 - 当前轮次: ${currentRound}, 目标轮次: ${round}`);

  await chapterWritingService.recordRoundGaps(season.id, round, 'ADMIN');

  const gaps = await prisma.roundGap.findMany({
    where: {
      seasonId: season.id,
      round,
      status: 'OPEN',
    },
    include: {
      book: {
        select: {
          id: true,
          title: true,
          author: { select: { nickname: true } },
        },
      },
    },
  });

  const gapByBook = new Map<string, GapInfo>();

  gaps.forEach((gap) => {
    const existing = gapByBook.get(gap.bookId) ?? {
      id: gap.bookId,
      title: gap.book.title,
      author: gap.book.author.nickname,
      chapterGaps: [] as number[],
      outlineGaps: [] as number[],
    };

    if (gap.gapType === 'CHAPTER') {
      existing.chapterGaps.push(gap.chapterNumber);
    } else {
      existing.outlineGaps.push(gap.chapterNumber);
    }

    gapByBook.set(gap.bookId, existing);
  });

  const gapBooks: GapInfo[] = Array.from(gapByBook.values()).map((item) => ({
    ...item,
    chapterGaps: Array.from(new Set(item.chapterGaps)).sort((a, b) => a - b),
    outlineGaps: Array.from(new Set(item.outlineGaps)).sort((a, b) => a - b),
  }));

  console.log(`[CatchUp API] 当前第 ${round} 轮，发现 ${gapBooks.length} 本存在缺口书籍`);

  if (gaps.length === 0) {
    return {
      seasonId: season.id,
      seasonNumber: season.seasonNumber,
      currentRound,
      targetRound: round,
      gapCount: 0,
      message: '没有缺口需要补齐',
    };
  }

  // 异步触发补漏
  setTimeout(async () => {
    try {
      await chapterWritingService.resolveRoundGaps(season.id, round);
    } catch (error) {
      console.error('[CatchUp API] 补漏任务失败:', error);
    }
  }, 100);

  return {
    seasonId: season.id,
    seasonNumber: season.seasonNumber,
    currentRound,
    targetRound: round,
    gapCount: gaps.length,
    books: gapBooks,
    message: `已触发补漏任务，正在处理第 ${round} 轮缺口`,
  };
}
