/**
 * 章节创作工具函数
 */

import { prisma } from '@/lib/prisma';
import { buildAuthorSystemPrompt, buildChapterPrompt } from '@/lib/secondme/prompts';
import { testModeSendChat, getUserTokenById } from '@/lib/secondme/client';
import { parseChapterWithRetry } from '@/lib/utils/llm-parser';
import { getDbConcurrency, getLlmConcurrency, runWithConcurrency } from './outline-utils';
import { normalizeZoneStyle } from './outline-prompt-builder';

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

export interface ChapterReadSnapshot {
  bookId: string;
  bookTitle: string;
  authorId: string;
  authorNickname: string;
  authorAgentConfig: Record<string, unknown>;
  zoneStyle: string;
  plannedChapters: number | null;
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

export interface PreparedChapterGeneration {
  bookId: string;
  bookTitle: string;
  authorId: string;
  authorNickname: string;
  chapterNumber: number;
  chapterOutlineTitle: string;
  systemPrompt: string;
  chapterPrompt: string;
  bookMaxChapters: number;
}

export interface GeneratedChapter {
  title: string;
  content: string;
}

/**
 * 构建章节快照
 */
export async function buildChapterSnapshotForBook(
  bookId: string,
  chapterNumber: number
): Promise<ChapterReadSnapshot | null> {
  const book = await prisma.book.findUnique({
    where: { id: bookId },
    select: { seasonId: true },
  });

  if (!book || !book.seasonId) {
    console.error(`[Chapter] 书籍不存在: ${bookId}`);
    return null;
  }

  const snapshots = await buildChapterSnapshots(book.seasonId, chapterNumber, [bookId]);
  return snapshots[0] ?? null;
}

/**
 * 构建多个章节快照
 */
export async function buildChapterSnapshots(
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
      plannedChapters: true,
      chaptersPlan: true,
      author: { select: { id: true, nickname: true, agentConfig: true } },
      _count: { select: { chapters: true } },
    },
  });

  const books = allBooks.filter(book => (book._count?.chapters ?? 0) < chapterNumber);
  if (books.length === 0) return [];

  const targetBookIds = books.map(book => book.id);

  // 获取上一章内容
  const previousChapters = await prisma.chapter.findMany({
    where: {
      bookId: { in: targetBookIds },
      chapterNumber: { lt: chapterNumber },
    },
    orderBy: { chapterNumber: 'desc' },
    select: { bookId: true, content: true, title: true, chapterNumber: true },
  });

  const previousMap = new Map<string, Array<{ content: string | null; title: string; chapterNumber: number }>>();
  previousChapters.forEach(chapter => {
    const list = previousMap.get(chapter.bookId) ?? [];
    if (list.length < 2) {
      list.push({ content: chapter.content, title: chapter.title, chapterNumber: chapter.chapterNumber });
      previousMap.set(chapter.bookId, list);
    }
  });

  // 获取上一章的评论反馈
  const feedbackMap = new Map<string, string[]>();
  targetBookIds.forEach(id => feedbackMap.set(id, []));

  if (chapterNumber > 1) {
    const comments = await prisma.comment.findMany({
      where: {
        bookId: { in: targetBookIds },
        chapter: { chapterNumber: chapterNumber - 1 },
      },
      orderBy: { createdAt: 'desc' },
      select: { bookId: true, content: true },
    });

    comments.forEach(comment => {
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
      console.log(`[Chapter] 跳过第 ${chapterNumber} 章：大纲缺失`);
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
        previousChapterContent = `第${latestChapter.chapterNumber}章"${latestChapter.title}"：${latestChapter.content.slice(0, 300)}...`;
      }
    }

    acc.push({
      bookId: book.id,
      bookTitle: book.title,
      authorId: book.author.id,
      authorNickname: book.author.nickname || '作家',
      authorAgentConfig: book.author.agentConfig as unknown as Record<string, unknown>,
      zoneStyle: book.zoneStyle,
      plannedChapters: book.plannedChapters ?? null,
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

/**
 * 准备章节生成
 */
export async function prepareChapterGeneration(
  snapshot: ChapterReadSnapshot
): Promise<PreparedChapterGeneration | null> {
  const rawConfig = snapshot.authorAgentConfig || {};
  const agentConfig: AgentConfig = {
    writerPersonality: (rawConfig.writerPersonality as string) || '',
    writingStyle: (rawConfig.writingStyle as string) || '多变',
    writingLengthPreference: (rawConfig.writingLengthPreference as 'short' | 'medium' | 'long') || 'medium',
    adaptability: (rawConfig.adaptability as number) ?? 0.5,
    preferredGenres: (rawConfig.preferredGenres as string[]) || [],
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
    zoneStyle: normalizeZoneStyle(snapshot.zoneStyle),
    wordCountTarget: agentConfig.wordCountTarget || 2000,
  });

  const outlineLength = snapshot.plannedChapters && snapshot.plannedChapters > 0
    ? snapshot.plannedChapters
    : snapshot.chaptersPlan.length;

  if (outlineLength <= 0) {
    throw new Error('缺少大纲章节数，无法生成章节');
  }

  const chapterPrompt = buildChapterPrompt({
    writerPersonality: agentConfig.writerPersonality || '',
    selfIntro: agentConfig.selfIntro || '',
    writingStyle: agentConfig.writingStyle || '多变',
    wordCountTarget: agentConfig.wordCountTarget || 2000,
    bookTitle: snapshot.bookTitle,
    chapterNumber: snapshot.chapterNumber,
    totalChapters: outlineLength,
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
    bookMaxChapters: outlineLength,
  };
}

/**
 * 生成章节内容
 */
export async function generateChapterContent(
  prepared: PreparedChapterGeneration
): Promise<GeneratedChapter> {
  const authorToken = await getUserTokenById(prepared.authorId);
  if (!authorToken) {
    throw new Error(`无法获取作者 ${prepared.authorNickname} 的 Token`);
  }

  const chapterData = await parseChapterWithRetry(
    () => testModeSendChat(prepared.chapterPrompt, prepared.systemPrompt, 'opennovel-writer', authorToken),
    prepared.chapterOutlineTitle,
    {
      taskId: `ChapterWrite-${prepared.bookTitle}-ch${prepared.chapterNumber}`,
      maxRetries: 3,
    }
  );

  console.log(`[ChapterWrite] 解析结果: bookId=${prepared.bookId}, chapter=${prepared.chapterNumber}, title=${chapterData.title}`);

  if (!chapterData.content) {
    throw new Error('LLM 未返回章节内容');
  }

  return chapterData;
}

export { getDbConcurrency, getLlmConcurrency, runWithConcurrency };
