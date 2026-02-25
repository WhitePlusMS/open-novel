// 大纲模块 Service
// 优化版本：使用 JSONB 类型，Prisma 自动解析
import { prisma } from '@/lib/prisma';
import { SecondMeClient } from '@/lib/secondme/client';
import { buildOutlinePrompt } from '@/lib/secondme/prompts';
import { parseLLMJsonWithRetry } from '@/lib/utils/llm-parser';
import { OutlineData, ChapterPlan, GenerateOutlineParams, Character } from '@/types/outline';
import { toJsonValue, fromJsonValue, safeJsonField } from '@/lib/utils/jsonb-utils';
import { userService } from './user.service';

export class OutlineService {
  /**
   * 生成大纲
   */
  async generateOutline(bookId: string, userId: string, params?: GenerateOutlineParams): Promise<OutlineData> {
    const book = await prisma.book.findUnique({
      where: { id: bookId },
      include: { season: true },
    });

    if (!book) {
      throw new Error('Book not found');
    }

    const secondMe = new SecondMeClient(userId);

    // 获取用户信息作为作家角色
    let userName = '作家';
    try {
      const userInfo = await secondMe.getUserInfo();
      userName = userInfo.name || '作家';
    } catch {
      console.warn('[OutlineService] Failed to get user info, using default name');
    }

    // 获取 Agent 配置
    const agentConfig = await userService.getAgentConfig(userId);

    // 构建章节偏好文本
    const lengthPreference = agentConfig?.writingLengthPreference || 'medium';
    const chapterPreferenceText = lengthPreference === 'short'
      ? '短篇小说'
      : lengthPreference === 'long'
        ? '长篇小说'
        : '中篇小说';

    // 构建 Prompt - JSONB 自动解析，无需 JSON.parse
    const prompt = buildOutlinePrompt({
      // Agent 性格配置
      writerPersonality: agentConfig?.writerPersonality || '',
      writingStyle: agentConfig?.writingStyle || '多变',

      // Agent 创作参数
      adaptability: agentConfig?.adaptability ?? 0.5,
      preferredGenres: agentConfig?.preferredGenres || [],
      wordCountTarget: agentConfig?.wordCountTarget || 2000,

      // 赛季信息
      seasonTheme: book.season?.themeKeyword || '自由创作',
      constraints: (book.season?.constraints as string[]) || [],
      zoneStyle: book.zoneStyle,
      minChapters: book.season?.minChapters,
      maxChapters: book.season?.maxChapters,
      chapterPreference: chapterPreferenceText,
      forcedChapter: params?.forcedChapter,
      forcedEvent: params?.forcedEvent,
      originalIntent: params?.originalIntent,
    });

    // 设置作家角色
    const systemPrompt = `你是${userName}，一个热爱创作的故事作家。请根据以下要求生成一个完整的故事大纲。`;

    console.log(`[OutlineService] Generating outline for book: ${bookId}`);

    // 流式生成大纲
    let outlineContent = '';
    for await (const chunk of secondMe.streamChat({
      message: prompt,
      systemPrompt,
    })) {
      outlineContent += chunk;
    }

    // 解析 JSON（使用统一的解析器，带重试机制）
    let outlineData: OutlineData;
    try {
      outlineData = await parseLLMJsonWithRetry<OutlineData>(
        async () => outlineContent,
        {
          taskId: `Outline-${bookId}`,
          maxRetries: 2,
        }
      );
    } catch (parseError) {
      console.error('[OutlineService] Failed to parse outline JSON:', parseError);
      throw new Error('Failed to parse generated outline');
    }

    // 保存大纲
    await this.saveOutline(bookId, outlineData);

    console.log(`[OutlineService] Outline generated for book: ${bookId}`);
    return outlineData;
  }

  /**
   * 保存大纲到数据库 - 使用 Book 的合并字段
   * JSONB 类型直接传入对象，Prisma 自动处理
   */
  async saveOutline(bookId: string, outline: OutlineData) {
    // 防御性检查：确保必要字段存在
    if (!outline) {
      throw new Error('Outline data is undefined');
    }
    if (!outline.chapters || !Array.isArray(outline.chapters)) {
      console.error('[OutlineService] outline.chapters is invalid:', outline.chapters);
      console.error('[OutlineService] Full outline data:', JSON.stringify(outline, null, 2));
      throw new Error('Outline data is missing chapters array');
    }
    if (!outline.characters || !Array.isArray(outline.characters)) {
      console.warn('[OutlineService] outline.characters is invalid, using empty array');
      outline.characters = [];
    }

    // 使用 Book 的合并字段保存大纲
    await prisma.book.update({
      where: { id: bookId },
      data: {
        originalIntent: outline.summary,
        // JSONB 直接传入数组
        characters: toJsonValue(outline.characters),
        chaptersPlan: toJsonValue(outline.chapters),
        longDesc: outline.summary,
        plannedChapters: outline.chapters.length,
      },
    });

    console.log(`[OutlineService] Outline saved for book: ${bookId}`);
  }

  /**
   * 获取大纲 - 从 Book 表获取
   */
  async getOutline(bookId: string) {
    const book = await prisma.book.findUnique({
      where: { id: bookId },
      select: {
        originalIntent: true,
        characters: true,
        chaptersPlan: true,
      },
    });

    if (!book) return null;

    return {
      summary: book.originalIntent || '',
      characters: safeJsonField(book.characters, []),
      chapters: safeJsonField(book.chaptersPlan, []),
    };
  }

  /**
   * 获取指定版本的大纲 - 从 BookOutlineVersion 表获取
   */
  async getOutlineByVersion(bookId: string, version: number) {
    const outlineVersion = await prisma.bookOutlineVersion.findUnique({
      where: {
        bookId_version: { bookId, version },
      },
    });

    if (!outlineVersion) return null;

    return {
      summary: outlineVersion.originalIntent || '',
      characters: safeJsonField(outlineVersion.characters, []),
      chapters: safeJsonField(outlineVersion.chaptersPlan, []),
    };
  }

  /**
   * 获取解析后的大纲数据
   * JSONB 自动解析，无需 JSON.parse
   */
  async getParsedOutline(bookId: string): Promise<OutlineData | null> {
    const outline = await this.getOutline(bookId);
    if (!outline) return null;

    return {
      title: '',
      summary: outline.summary,
      // JSONB 自动解析 - 使用类型断言
      characters: (outline.characters as Character[]) || [],
      chapters: (outline.chapters as ChapterPlan[]) || [],
      themes: [],
      tone: '',
    };
  }

  /**
   * 更新大纲章节
   * JSONB 自动处理
   */
  async updateChapterPlan(
    bookId: string,
    chapterNumber: number,
    plan: Partial<ChapterPlan>
  ) {
    const book = await prisma.book.findUnique({
      where: { id: bookId },
      select: {
        chaptersPlan: true,
        modificationLog: true,
      },
    });
    if (!book) throw new Error('Book not found');

    // JSONB 自动解析
    const chapters = fromJsonValue<ChapterPlan[]>(book.chaptersPlan) || [];
    const index = chapters.findIndex((c) => c.number === chapterNumber);
    if (index === -1) throw new Error('Chapter not found');

    chapters[index] = { ...chapters[index], ...plan };

    // 记录修改日志 - JSONB 自动处理
    const mods = fromJsonValue<Array<{
      chapterNumber: number;
      updatedAt: string;
      changes: Partial<ChapterPlan>;
    }>>(book.modificationLog) || [];
    mods.push({
      chapterNumber,
      updatedAt: new Date().toISOString(),
      changes: plan,
    });

    return prisma.book.update({
      where: { id: bookId },
      data: {
        chaptersPlan: toJsonValue(chapters),
        modificationLog: toJsonValue(mods),
      },
    });
  }

  /**
   * 添加修改日志
   * JSONB 自动处理
   */
  async addModificationLog(
    bookId: string,
    chapterNumber: number,
    changes: Partial<ChapterPlan>
  ) {
    const book = await prisma.book.findUnique({
      where: { id: bookId },
      select: { modificationLog: true },
    });
    if (!book) return;

    // JSONB 自动解析和处理
    const mods = fromJsonValue<Array<{
      chapterNumber: number;
      updatedAt: string;
      changes: Partial<ChapterPlan>;
    }>>(book.modificationLog) || [];
    mods.push({
      chapterNumber,
      updatedAt: new Date().toISOString(),
      changes,
    });

    await prisma.book.update({
      where: { id: bookId },
      data: {
        modificationLog: toJsonValue(mods),
      },
    });
  }
}

export const outlineService = new OutlineService();
