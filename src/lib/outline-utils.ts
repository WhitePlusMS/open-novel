/**
 * 大纲生成工具函数
 */

import { prisma } from '@/lib/prisma';
import { toJsonValue } from '@/lib/utils/jsonb-utils';
import type { BookOutline, ChapterOutline, OutlineReadSnapshot, NextOutlineSnapshot } from '@/types';

/**
 * 获取数据库并发数
 */
export function getDbConcurrency(): number {
  const raw = Number(process.env.DB_CONCURRENCY || process.env.TASK_CONCURRENCY);
  const fallback = 3;
  if (Number.isFinite(raw) && raw > 0) return Math.min(3, Math.floor(raw));
  return fallback;
}

/**
 * 获取 LLM 并发数
 */
export function getLlmConcurrency(): number {
  const raw = Number(process.env.LLM_CONCURRENCY || process.env.AI_CONCURRENCY);
  const fallback = process.env.NODE_ENV === 'production' ? 4 : 6;
  if (Number.isFinite(raw) && raw > 0) return Math.floor(raw);
  return fallback;
}

/**
 * 并发执行工具函数
 */
export async function runWithConcurrency<T>(
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
 * 构建赛季大纲快照
 */
export async function buildOutlineSnapshots(seasonId: string): Promise<OutlineReadSnapshot[]> {
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

/**
 * 为单本书构建大纲快照
 */
export async function buildOutlineSnapshotForBook(bookId: string): Promise<OutlineReadSnapshot | null> {
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

/**
 * 构建下一章大纲快照
 */
export async function buildNextOutlineSnapshots(
  bookIds: string[],
  targetRound?: number
): Promise<NextOutlineSnapshot[]> {
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

  const commentsMap = await buildAllChapterComments(bookIds, chapterCountMap);

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

/**
 * 构建所有章节评论
 */
export async function buildAllChapterComments(
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

/**
 * 保存大纲版本
 */
export async function saveOutlineVersion(
  bookId: string,
  roundCreated: number,
  reason?: string
): Promise<number> {
  const latestVersion = await prisma.bookOutlineVersion.findFirst({
    where: { bookId },
    orderBy: { version: 'desc' },
  });

  const newVersion = (latestVersion?.version ?? 0) + 1;

  const book = await prisma.book.findUnique({
    where: { id: bookId },
    select: { originalIntent: true, characters: true, chaptersPlan: true },
  });

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
 * 获取章节概要
 */
export function getChapterSummary(chapters: ChapterOutline[], chapterNumber: number): string {
  const chapter = chapters.find((c) => c.number === chapterNumber);
  return chapter?.summary || '';
}
