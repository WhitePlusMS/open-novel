/**
 * 测试章节生成 API
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { buildAuthorSystemPrompt, buildChapterPrompt } from '@/lib/secondme/prompts';
import { testModeSendChat, getUserTokenById } from '@/lib/secondme/client';
import { parseChapterFromPlainText } from '@/lib/utils/llm-parser';

export async function POST(request: NextRequest) {
  try {
    const { bookId, chapterNumber } = await request.json();

    if (!bookId || !chapterNumber) {
      return NextResponse.json(
        { error: '缺少必要参数 bookId 和 chapterNumber' },
        { status: 400 }
      );
    }

    console.log(`[TestChapter] 开始测试生成 - bookId: ${bookId}, chapterNumber: ${chapterNumber}`);

    // 1. 获取书籍和作者信息
    const book = await prisma.book.findUnique({
      where: { id: bookId },
      include: {
        author: { select: { id: true, nickname: true, agentConfig: true } },
        chapters: {
          orderBy: { chapterNumber: 'desc' },
          take: 1,
        },
      },
    });

    if (!book) {
      return NextResponse.json({ error: '书籍不存在' }, { status: 404 });
    }

    // 获取最新大纲
    const latestOutline = await prisma.book.findUnique({
      where: { id: bookId },
      select: {
        chaptersPlan: true,
        characters: true,
        originalIntent: true,
      },
    });

    if (!latestOutline || !latestOutline.chaptersPlan) {
      return NextResponse.json({ error: '书籍没有大纲' }, { status: 400 });
    }

    // 解析大纲
    const chaptersPlan = latestOutline.chaptersPlan as unknown as Array<{
      number: number;
      title: string;
      summary: string;
      key_events: string[];
      word_count_target: number;
    }>;
    const chapterOutline = chaptersPlan.find(c => c.number === chapterNumber);

    if (!chapterOutline) {
      return NextResponse.json({ error: '大纲中没有该章节' }, { status: 400 });
    }

    // 2. 解析作者配置
    const rawConfig = (book.author.agentConfig as unknown as Record<string, unknown>) || {};
    const agentConfig = {
      writerPersonality: (rawConfig.writerPersonality as string) || '',
      writingStyle: (rawConfig.writingStyle as string) || '多变',
      adaptability: (rawConfig.adaptability as number) ?? 0.5,
      preferredGenres: (rawConfig.preferredGenres as string[]) || [],
      wordCountTarget: (rawConfig.wordCountTarget as number) || 2000,
    };

    // 3. 获取上一章内容（如果有）
    let previousChapterContent: string | undefined;
    const previousChapter = book.chapters.find(c => c.chapterNumber === chapterNumber - 1);
    if (previousChapter) {
      previousChapterContent = previousChapter.content;
    }

    // 4. 构建 System Prompt
    const systemPrompt = buildAuthorSystemPrompt({
      userName: book.author.nickname || '作家',
      writerPersonality: agentConfig.writerPersonality,
      writingStyle: agentConfig.writingStyle,
      adaptability: agentConfig.adaptability,
      preferredGenres: agentConfig.preferredGenres,
      seasonTheme: '赛博大唐',
      constraints: ['无'],
      zoneStyle: book.zoneStyle || '赛博朋克',
      wordCountTarget: agentConfig.wordCountTarget,
    });

    // 5. 构建章节生成 Prompt
    const chapterPrompt = buildChapterPrompt({
      writerPersonality: agentConfig.writerPersonality,
      writingStyle: agentConfig.writingStyle,
      wordCountTarget: agentConfig.wordCountTarget,
      bookTitle: book.title,
      chapterNumber,
      totalChapters: chaptersPlan.length,
      outline: {
        summary: chapterOutline.summary,
        key_events: chapterOutline.key_events,
        word_count_target: chapterOutline.word_count_target,
      },
      // 整本书大纲（新增）
      fullOutline: chaptersPlan,
      previousSummary: latestOutline.originalIntent || '无',
      previousChapterContent,
    });

    // 6. 获取作者的 token
    const authorToken = await getUserTokenById(book.author.id);
    if (!authorToken) {
      return NextResponse.json({ error: '无法获取作者 Token' }, { status: 500 });
    }

    console.log(`[TestChapter] 开始调用 LLM...`);

    // 7. 调用 LLM 生成章节
    const llmResponse = await testModeSendChat(
      chapterPrompt,
      systemPrompt,
      'opennovel-test',
      authorToken
    );

    // 8. 解析响应
    const chapterData = parseChapterFromPlainText(llmResponse, chapterOutline.title);

    if (!chapterData.content) {
      return NextResponse.json({ error: 'LLM 未返回有效内容' }, { status: 500 });
    }

    console.log(`[TestChapter] 解析成功 - title: ${chapterData.title}, contentLength: ${chapterData.content.length}`);

    return NextResponse.json({
      success: true,
      bookId: book.id,
      bookTitle: book.title,
      chapterNumber,
      title: chapterData.title,
      content: chapterData.content,
      contentLength: chapterData.content.length,
      author: book.author.nickname,
    });
  } catch (error) {
    console.error('[TestChapter] 生成失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '生成失败' },
      { status: 500 }
    );
  }
}
