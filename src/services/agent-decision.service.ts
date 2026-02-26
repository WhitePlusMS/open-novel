/**
 * Agent 决策服务
 *
 * 处理 Agent 参赛决策的逻辑
 */

import { prisma } from '@/lib/prisma';
import { testModeSendChat, getCurrentUserToken } from '@/lib/secondme/client';
import { parseLLMJsonWithRetry } from '@/lib/utils/llm-parser';
import { safeJsonField } from '@/lib/utils/jsonb-utils';
import { normalizeZoneStyle } from '@/lib/utils/zone';
import { AuthorConfig } from '@/types/agent-config';
import { SeasonInfo } from '@/types/season-admin';
import { getRetryDelay, DECISION_RETRY_CONFIG, CHAPTER_WRITING_CONFIG } from '@/config/season.constants';

// Agent 配置接口（简化版，用于决策）
interface AgentConfigForDecision {
  writerPersonality: string;
  writingStyle: string;
  writingLengthPreference: 'short' | 'medium' | 'long';
  adaptability: number;
  description?: string;
  preferredGenres: string[];
  wordCountTarget: number;
}

/**
 * Agent 参赛决策结果
 */
export interface AgentDecision {
  decision: 'join' | 'skip';
  bookTitle?: string;
  shortDescription?: string;
  zoneStyle?: string;
  reason: string;
}

/**
 * 获取默认 Agent 配置
 */
function getDefaultAgentConfig(nickname: string): AgentConfigForDecision {
  return {
    writerPersonality: '',
    writingStyle: '多变',
    writingLengthPreference: 'medium',
    adaptability: CHAPTER_WRITING_CONFIG.DEFAULT_ADAPTABILITY,
    description: nickname,
    preferredGenres: [],
    wordCountTarget: CHAPTER_WRITING_CONFIG.DEFAULT_WORD_COUNT,
  };
}

/**
 * 从 writerPersonality 中提取核心性格描述
 */
function extractCorePersonality(personality: string): string {
  if (!personality) return '性格多变';

  // 如果包含"兴趣标签："，只取其前面的部分
  const corePart = personality.split('兴趣标签：')[0].trim();

  // 清理多余的空白和换行
  return corePart.replace(/\s+/g, ' ').trim() || '性格多变';
}

/**
 * 将写作长短偏好转换为创作偏好描述
 */
function getChapterPreference(preference?: string): string {
  if (preference === 'short') return '短篇小说';
  if (preference === 'long') return '长篇小说';
  return '中篇小说';
}

/**
 * 调用 SecondMe API 获取 Agent 参赛决策
 */
async function callSecondMeForDecision(
  config: AgentConfigForDecision,
  seasonInfo: SeasonInfo
): Promise<AgentDecision> {
  const token = await getCurrentUserToken();
  if (!token) {
    throw new Error('无法获取用户 Token，请确保已登录');
  }

  // 构建消息
  const userMessage = `
## 赛季信息
- 主题：${seasonInfo.themeKeyword}
- 可选分区：${seasonInfo.zoneStyles.join('、')}
- 章节要求：${seasonInfo.minChapters} - ${seasonInfo.maxChapters} 章
- 硬性限制：${seasonInfo.constraints.join('；')}

## 奖励机制
${JSON.stringify(seasonInfo.rewards || {})}

请根据你的性格特征，决定是否参赛。

重要：直接输出 JSON，不要用 \`\`\`json 包裹，不要有任何其他文字！
JSON 格式：
{
  "decision": "join" 或 "skip",
  "bookTitle": "《书名》"（仅 decision=join 时）,
  "shortDescription": "一句话简介"（仅 decision=join 时）,
  "zoneStyle": "urban" 或 "fantasy" 或 "scifi"（仅 decision=join 时）,
  "reason": "决策理由"
}`;

  const lengthPreferenceText = getChapterPreference(config.writingLengthPreference);
  const wordCount = config.wordCountTarget || CHAPTER_WRITING_CONFIG.DEFAULT_WORD_COUNT;

  const systemPrompt = `你是一名作家，具有以下性格特征：
- 性格：${extractCorePersonality(config.writerPersonality) || '性格多变'}
- 写作风格：${config.writingStyle || '多变'}
- 听劝指数：${config.adaptability ?? CHAPTER_WRITING_CONFIG.DEFAULT_ADAPTABILITY}（越高越会采纳读者意见）
- 偏好题材：${config.preferredGenres?.join('、') || '不限'}
- 章节偏好：${lengthPreferenceText}，每章约 ${wordCount} 字

重要：直接输出 JSON 对象，不要用任何符号包裹，不要有解释性文字！`;

  const maxRetries = DECISION_RETRY_CONFIG.MAX_RETRIES;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      const parsed = await parseLLMJsonWithRetry<{
        decision: string;
        bookTitle?: string;
        shortDescription?: string;
        zoneStyle?: string;
        reason: string;
      }>(
        () => testModeSendChat(userMessage, systemPrompt, 'opennovel-season', token),
        {
          taskId: `AgentDecision-${config.description}`,
          maxRetries: 0,
        }
      );

      if (parsed.decision === 'join' && parsed.bookTitle && parsed.zoneStyle) {
        return {
          decision: 'join',
          bookTitle: parsed.bookTitle,
          shortDescription: parsed.shortDescription || '',
          zoneStyle: parsed.zoneStyle,
          reason: parsed.reason || '根据性格特征做出的决策',
        };
      }

      if (parsed.decision === 'skip') {
        return {
          decision: 'skip',
          reason: parsed.reason || '选择不参赛',
        };
      }

      throw new Error(`无法识别的决策: ${parsed.decision}`);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt >= maxRetries) {
        throw lastError;
      }
      const delay = getRetryDelay(attempt);
      console.warn(`[AgentDecision] 决策解析失败，${delay}ms 后重试: ${lastError.message}`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError ?? new Error('参赛决策失败');
}

/**
 * 为所有 Agent 获取参赛决策
 */
export async function getAgentDecisions(seasonInfo: SeasonInfo) {
  const users = await prisma.user.findMany({
    where: {
      agentConfig: { not: null as unknown as undefined },
    },
    orderBy: { createdAt: 'asc' },
  });

  if (users.length === 0) {
    return [];
  }

  const decisionPromises = users.map(async (user) => {
    const config: AgentConfigForDecision = safeJsonField<AuthorConfig>(
      user.agentConfig,
      getDefaultAgentConfig(user.nickname)
    );

    try {
      const decision = await callSecondMeForDecision(config, seasonInfo);
      return {
        user,
        config,
        success: true,
        decision: decision.decision,
        bookTitle: decision.bookTitle,
        shortDescription: decision.shortDescription,
        zoneStyle: decision.zoneStyle,
        reason: decision.reason,
      };
    } catch (error) {
      console.error(`[AgentDecision] Agent ${user.nickname} 决策失败:`, error);
      return {
        user,
        config,
        success: false,
        decision: 'skip' as const,
        reason: `决策失败: ${(error as Error).message}`,
      };
    }
  });

  return Promise.all(decisionPromises);
}

/**
 * 根据决策结果创建书籍
 */
export async function createBooksFromDecisions(
  seasonId: string,
  decisions: Array<{
    user: { id: string; nickname: string };
    config: AgentConfigForDecision;
    success: boolean;
    decision: 'join' | 'skip';
    bookTitle?: string;
    shortDescription?: string;
    zoneStyle?: string;
    reason: string;
  }>
) {
  const usedTitles = new Set<string>();
  const joinResults: Array<{
    user: { id: string; nickname: string };
    bookTitle: string;
    shortDescription: string;
    zoneStyle: string;
    reason: string;
  }> = [];
  const skipResults: Array<{ user: string; reason: string }> = [];

  // 处理决策结果
  for (const decision of decisions) {
    if (decision.success && decision.decision === 'join' && decision.bookTitle && decision.zoneStyle) {
      // 清理书名格式并确保唯一
      const cleanTitle = decision.bookTitle.replace(/《|》/g, '');
      let finalTitle = cleanTitle;
      let counter = 1;
      while (usedTitles.has(finalTitle)) {
        finalTitle = `${cleanTitle}_${counter++}`;
      }
      usedTitles.add(finalTitle);

      joinResults.push({
        user: decision.user,
        bookTitle: finalTitle,
        shortDescription: decision.shortDescription || '',
        zoneStyle: decision.zoneStyle,
        reason: decision.reason,
      });
    } else {
      skipResults.push({
        user: decision.user.nickname,
        reason: decision.reason,
      });
    }
  }

  // 并发创建书籍
  const bookPromises = joinResults.map(async (joinResult) => {
    const { user, bookTitle, shortDescription, zoneStyle } = joinResult;
    const zoneCn = normalizeZoneStyle(zoneStyle);

    try {
      // 检查用户是否已参赛
      const existingBook = await prisma.book.findFirst({
        where: {
          authorId: user.id,
          seasonId,
        },
      });

      if (existingBook) {
        console.log(`[SeasonStart] 用户 ${user.nickname} 已参赛，跳过`);
        return { user, book: existingBook, success: true as const, skipped: true };
      }

      // 创建书籍
      const book = await prisma.book.create({
        data: {
          title: bookTitle,
          shortDesc: shortDescription || '暂无简介',
          zoneStyle: zoneCn,
          authorId: user.id,
          seasonId,
          status: 'ACTIVE',
          inkBalance: 50,
        },
      });

      console.log(`[SeasonStart]   [成功] 《${bookTitle}》创建成功`);
      return { user, book, success: true as const, skipped: false };
    } catch (error) {
      console.error(`[SeasonStart]   [失败] 创建书籍《${bookTitle}》失败:`, error);
      return { user, bookTitle, reason: error, success: false as const };
    }
  });

  const bookResults = await Promise.allSettled(bookPromises);
  const joinCount = bookResults.filter(
    result => result.status === 'fulfilled' && result.value.success
  ).length;

  return {
    bookResults,
    joinCount,
    skipCount: skipResults.length,
  };
}

/**
 * 创建新赛季
 */
export async function createSeason(seasonInfo: {
  seasonNumber?: number;
  themeKeyword: string;
  constraints: readonly string[] | string[];
  zoneStyles: readonly string[] | string[];
  maxChapters: number;
  minChapters: number;
  roundDuration: number;
  rewards: Record<string, unknown>;
}) {
  // 获取当前最大的赛季号
  const maxSeason = await prisma.season.findFirst({
    orderBy: { seasonNumber: 'desc' },
    select: { seasonNumber: true },
  });

  const nextNumber = seasonInfo.seasonNumber ?? (maxSeason?.seasonNumber ?? 0) + 1;

  // 检查赛季号是否已存在
  const existingByNumber = await prisma.season.findUnique({
    where: { seasonNumber: nextNumber },
  });

  if (existingByNumber) {
    throw new Error(`赛季 S${nextNumber} 已存在`);
  }

  const now = new Date();
  const totalSeasonMinutes = seasonInfo.roundDuration * seasonInfo.maxChapters + 10;
  const endTime = new Date(now.getTime() + totalSeasonMinutes * 60 * 1000);

  const season = await prisma.season.create({
    data: {
      seasonNumber: nextNumber,
      themeKeyword: seasonInfo.themeKeyword,
      constraints: JSON.stringify(seasonInfo.constraints),
      zoneStyles: JSON.stringify(seasonInfo.zoneStyles),
      startTime: now,
      endTime,
      signupDeadline: new Date(now.getTime() + 10 * 60 * 1000),
      roundDuration: seasonInfo.roundDuration,
      maxChapters: seasonInfo.maxChapters,
      minChapters: seasonInfo.minChapters,
      rewards: JSON.stringify(seasonInfo.rewards),
      status: 'ACTIVE',
      participantCount: 0,
    },
  });

  return season;
}

/**
 * 获取所有有 Agent 配置的用户
 */
export async function getAgentsWithConfig() {
  return prisma.user.findMany({
    where: {
      agentConfig: { not: null as unknown as undefined },
    },
    orderBy: { createdAt: 'asc' },
  });
}
