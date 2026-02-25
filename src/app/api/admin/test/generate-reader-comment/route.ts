/**
 * 测试读者评论生成 API
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { buildReaderSystemPrompt, buildReaderActionControl } from '@/lib/secondme/prompts';
import { testModeSendChat } from '@/lib/secondme/client';
import { parseLLMJsonWithRetry } from '@/lib/utils/llm-parser';
import { safeJsonField } from '@/lib/utils/jsonb-utils';
import { READER_AGENT_DEFAULTS, ReaderFeedback } from '@/config/reader-agent.constants';

// 测试模式默认配置
const DEFAULT_READER_CONFIG = {
  readerPersonality: READER_AGENT_DEFAULTS.DEFAULT_PERSONALITY,
  readingPreferences: READER_AGENT_DEFAULTS.DEFAULT_PREFERENCES,
  commentingBehavior: READER_AGENT_DEFAULTS.DEFAULT_COMMENTING,
  interactionBehavior: READER_AGENT_DEFAULTS.DEFAULT_INTERACTION,
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { bookId, chapterNumber, testMode } = body;

    if (!bookId || !chapterNumber) {
      return NextResponse.json(
        { error: '缺少必要参数 bookId 和 chapterNumber' },
        { status: 400 }
      );
    }

    console.log(`[TestReaderComment] 开始测试 - bookId: ${bookId}, chapterNumber: ${chapterNumber}, testMode: ${testMode}`);

    // 1. 获取书籍和章节信息（包括作者的读者配置）
    const book = await prisma.book.findUnique({
      where: { id: bookId },
      include: {
        author: {
          select: {
            id: true,
            nickname: true,
            readerConfig: true,
          },
        },
        chapters: {
          where: { chapterNumber },
          take: 1,
        },
      },
    });

    if (!book) {
      return NextResponse.json({ error: '书籍不存在' }, { status: 404 });
    }

    const chapter = book.chapters[0];
    if (!chapter) {
      return NextResponse.json({ error: '章节不存在' }, { status: 404 });
    }

    // 2. 获取读者配置（从书籍作者的配置中读取）
    let readerConfig;
    if (testMode) {
      // 测试模式：使用默认配置
      readerConfig = DEFAULT_READER_CONFIG;
      console.log(`[TestReaderComment] 测试模式：使用默认读者配置`);
    } else {
      // 正式模式：从数据库读取作者配置的读者设置
      readerConfig = safeJsonField(book.author.readerConfig, DEFAULT_READER_CONFIG);
      console.log(`[TestReaderComment] 正式模式：使用数据库中的读者配置`);
    }

    const readerName = testMode ? '测试读者' : '读者';

    // 3. 构建 System Prompt
    const systemPrompt = buildReaderSystemPrompt({
      readerName,
      readerPersonality: readerConfig.readerPersonality,
      preferences: {
        genres: readerConfig.readingPreferences.preferredGenres,
        style: readerConfig.readingPreferences.style,
        minRating: readerConfig.readingPreferences.minRatingThreshold,
      },
    });

    // 4. 构建用户消息（包含章节内容）
    const actionControl = buildReaderActionControl();
    const message = `你正在阅读《${book.title}》第 ${chapter.chapterNumber} 章 "${chapter.title}"，作者：${book.author.nickname}。

## 章节内容
${chapter.content.slice(0, READER_AGENT_DEFAULTS.CHAPTER_CONTENT_TRUNCATE)} ${chapter.content.length > READER_AGENT_DEFAULTS.CHAPTER_CONTENT_TRUNCATE ? '...(内容截断)' : ''}

${actionControl}`;

    // 5. 调用 LLM 生成评论
    console.log(`[TestReaderComment] 开始调用 LLM...`);

    // 6. 调用 LLM 生成评论
    const llmResponse = await testModeSendChat(
      message,
      systemPrompt,
      'inksurvivor-reader',
      undefined // 使用默认测试 token
    );

    // 7. 解析响应
    const feedback = await parseLLMJsonWithRetry<ReaderFeedback>(
      async () => llmResponse,
      {
        taskId: `TestReader-${book.title}-ch${chapterNumber}`,
        maxRetries: 3,
      }
    );

    if (!feedback) {
      return NextResponse.json({ error: 'LLM 未返回有效评论' }, { status: 500 });
    }

    // 8. 将评论存入数据库
    const savedComment = await prisma.comment.create({
      data: {
        bookId: book.id,
        chapterId: chapter.id,
        isHuman: false,
        aiRole: '读者',
        content: null, // AI读者评论不使用此字段
        rating: feedback.overall_rating,
        praise: feedback.praise,
        critique: feedback.critique,
      },
    });

    console.log(`[TestReaderComment] 评论已存入数据库 - commentId: ${savedComment.id}, 评分: ${feedback.overall_rating}/10`);

    // 9. 构建评论结果
    const comments = [
      {
        readerName,
        rating: feedback.overall_rating,
        praise: feedback.praise,
        critique: feedback.critique,
      },
    ];

    console.log(`[TestReaderComment] 生成成功 - 评分: ${feedback.overall_rating}/10`);
    return NextResponse.json({
      success: true,
      bookId: book.id,
      bookTitle: book.title,
      chapterNumber: chapter.chapterNumber,
      chapterTitle: chapter.title,
      commentId: savedComment.id, // 返回存储的评论ID
      comments,
    });
  } catch (error) {
    console.error('[TestReaderComment] 生成失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '生成失败' },
      { status: 500 }
    );
  }
}
