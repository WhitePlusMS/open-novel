/**
 * 测试功能：开始正式赛季
 * POST /api/admin/test/start-season
 *
 * PRD 参赛流程：
 * 1. 系统向所有 Agent 发送完整的赛季邀请消息
 * 2. Agent 根据性格配置自主决策是否参赛
 * 3. Agent 调用 LLM 生成参赛回复「参赛 《书名》 简介 分区」
 * 4. 系统解析回复，创建书籍
 *
 * 注意：所有 LLM 调用必须走真实 SecondMe API，不允许降级到模拟数据
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { testModeSendChat, getCurrentUserToken } from '@/lib/secondme/client';
import { parseLLMJsonWithRetry } from '@/lib/utils/llm-parser';
import { normalizeZoneStyle } from '@/lib/utils/zone';
import { safeJsonField } from '@/lib/utils/jsonb-utils';
import { requireAdmin, createUnauthorizedResponse, createForbiddenResponse } from '@/lib/utils/admin';

// Agent 配置接口
interface AgentConfig {
  // 基础信息
  writerPersonality: string;  // 作者性格描述

  // 写作偏好
  writingStyle: string;      // 写作风格
  writingLengthPreference: 'short' | 'medium' | 'long';

  // 创作参数
  adaptability: number;     // 听劝指数
  description: string;     // 显示名称
  preferredGenres: string[]; // 偏好题材
  wordCountTarget: number; // 每章目标字数
}

const DECISION_RETRY_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
};

function getRetryDelay(attempt: number): number {
  const delay = DECISION_RETRY_CONFIG.baseDelayMs * Math.pow(DECISION_RETRY_CONFIG.backoffMultiplier, attempt);
  return Math.min(delay, DECISION_RETRY_CONFIG.maxDelayMs);
}

/**
 * 赛季信息接口
 */
interface SeasonInfo {
  seasonNumber: number;
  themeKeyword: string;
  constraints: string[];
  zoneStyles: string[];
  rewards: Record<string, unknown>;
  minChapters: number;
  maxChapters: number;
}

/**
 * 调用 SecondMe API 获取 Agent 参赛决策
 * 使用指数退避重试机制，解析失败时最多重试 3 次
 */
async function callSecondMeForDecision(
  config: AgentConfig,
  seasonInfo: SeasonInfo
): Promise<{
  decision: string;
  bookTitle?: string;
  shortDescription?: string;
  zoneStyle?: string;
  reason: string;
}> {
  const token = await getCurrentUserToken();
  if (!token) {
    throw new Error('无法获取用户 Token，请确保已登录');
  }

  // 构建消息 - 要求返回纯 JSON 格式
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

  const lengthPreferenceText = config.writingLengthPreference === 'short'
    ? '短篇小说'
    : config.writingLengthPreference === 'long'
      ? '长篇小说'
      : '中篇小说';

  const systemPrompt = `你是一名作家，具有以下性格特征：
- 性格：${config.writerPersonality || '性格多变'}
- 写作风格：${config.writingStyle || '多变'}
- 听劝指数：${config.adaptability ?? 0.5}（越高越会采纳读者意见）
- 偏好题材：${config.preferredGenres?.join('、') || '不限'}
- 章节偏好：${lengthPreferenceText}，每章${config.wordCountTarget || 2000}字

重要：直接输出 JSON 对象，不要用任何符号包裹，不要有解释性文字！`;

  const maxRetries = DECISION_RETRY_CONFIG.maxRetries;
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
        () => testModeSendChat(userMessage, systemPrompt, 'inksurvivor-season', token),
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
      console.warn(`[StartSeason] 决策解析失败，${delay}ms 后重试: ${lastError.message}`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError ?? new Error('参赛决策失败');
}

export async function POST(request: NextRequest) {
  try {
    // 1. 验证管理员权限
    const authResult = await requireAdmin();
    if (!authResult.success) {
      const response = authResult.message.includes('登录')
        ? createUnauthorizedResponse('请先登录管理员账号')
        : createForbiddenResponse();
      return NextResponse.json(response, { status: authResult.message.includes('登录') ? 401 : 403 });
    }

    // 2. 获取请求体中的配置参数
    const body = await request.json().catch(() => ({}));
    const {
      seasonNumber,
      themeKeyword = '赛博朋克',
      constraints = ['不能出现真实地名', '主角必须有成长弧线'],
      zoneStyles = ['urban', 'fantasy', 'scifi'],
      maxChapters = 7,
      minChapters = 3,
      // 各阶段时长（分钟）- 现在简化为 roundDuration
      roundDuration = 20,
      rewards = { first: 1000, second: 500, third: 200 },
    } = body;

    console.log('[StartSeason] 开始正式赛季...', {
      seasonNumber,
      themeKeyword,
      maxChapters,
      minChapters,
      roundDuration,
      rewards,
      constraints,
      zoneStyles,
    });

    // 3. 获取所有用户（作为 Agent）
    const users = await prisma.user.findMany({
      where: {
        agentConfig: { not: null as unknown as undefined }, // 只选择有 Agent 配置的用户
      },
      orderBy: { createdAt: 'asc' },
    });

    if (users.length === 0) {
      return NextResponse.json({
        code: 400,
        data: null,
        message: '没有找到 Agent，请确保有用户配置了 Agent',
      });
    }

    console.log(`[StartSeason] 找到 ${users.length} 个 Agent`);

    // 4. 检查是否已有进行中的赛季
    const existingSeason = await prisma.season.findFirst({
      where: { status: 'ACTIVE' },
    });

    let season;
    if (existingSeason) {
      season = existingSeason;
      console.log(`[StartSeason] 使用已有赛季: S${season.seasonNumber}`);
    } else {
      // 5. 创建新赛季
      let nextNumber: number;
      if (seasonNumber) {
        nextNumber = seasonNumber;
      } else {
        // 获取当前最大的赛季号，然后 +1
        const maxSeason = await prisma.season.findFirst({
          orderBy: { seasonNumber: 'desc' },
          select: { seasonNumber: true },
        });
        nextNumber = (maxSeason?.seasonNumber ?? 0) + 1;
      }

      // 检查该赛季号是否已存在
      const existingSeasonByNumber = await prisma.season.findUnique({
        where: { seasonNumber: nextNumber },
      });

      if (existingSeasonByNumber) {
        return NextResponse.json({
          code: 400,
          data: null,
          message: `赛季 S${nextNumber} 已存在，请使用不同的赛季号或先结束现有赛季`,
        });
      }

      const now = new Date();

      // 计算赛季总时长 = roundDuration * maxChapters + 报名截止 10 分钟
      const totalSeasonMinutes = roundDuration * maxChapters + 10;
      const endTime = new Date(now.getTime() + totalSeasonMinutes * 60 * 1000);

      season = await prisma.season.create({
        data: {
          seasonNumber: nextNumber,
          themeKeyword,
          constraints: JSON.stringify(constraints),
          zoneStyles: JSON.stringify(zoneStyles),
          startTime: now,
          endTime,
          signupDeadline: new Date(now.getTime() + 10 * 60 * 1000),
          roundDuration,
          maxChapters,
          minChapters,
          rewards: JSON.stringify(rewards),
          status: 'ACTIVE',
          participantCount: 0,
        },
      });

      console.log(`[StartSeason] 创建新赛季: S${season.seasonNumber} - ${season.themeKeyword} (最大${season.maxChapters}章, roundDuration=${season.roundDuration}, 预计结束时间=${season.endTime})`);
    }

    // 赛季信息（用于 API 调用）
    const seasonInfo = {
      seasonNumber: season.seasonNumber,
      themeKeyword: season.themeKeyword,
      constraints: JSON.parse((season.constraints as unknown as string) || '[]'),
      zoneStyles: JSON.parse((season.zoneStyles as unknown as string) || '[]'),
      rewards: JSON.parse((season.rewards as unknown as string) || '{}'),
      minChapters: season.minChapters,
      maxChapters: season.maxChapters,
    };

    // 6. 并发获取所有 Agent 的参赛决策
    console.log(`[StartSeason] 向 ${users.length} 个 Agent 并发发送赛季邀请...`);

    const decisionPromises = users.map(async (user) => {
      const config: AgentConfig = safeJsonField<AgentConfig>(user.agentConfig, {
        // 基础信息
        writerPersonality: '',
        // 写作偏好
        writingStyle: '',
        writingLengthPreference: 'medium',
        // 创作参数
        adaptability: 0.5,
        description: '',
        preferredGenres: [],
        wordCountTarget: 2000,
      });
      try {
        const llmResponse = await callSecondMeForDecision(config, seasonInfo);
        return {
          user,
          config,
          success: true,
          decision: llmResponse.decision,
          bookTitle: llmResponse.bookTitle,
          shortDescription: llmResponse.shortDescription,
          zoneStyle: llmResponse.zoneStyle,
          reason: llmResponse.reason,
        };
      } catch (error) {
        console.error(`[StartSeason] Agent ${user.nickname} 决策失败:`, error);
        return {
          user,
          config,
          success: false,
          decision: 'skip',
          reason: `决策失败: ${(error as Error).message}`,
        };
      }
    });

    const decisions = await Promise.allSettled(decisionPromises);

    // 解析决策结果
    const joinResults: Array<{
      user: typeof users[0];
      config: AgentConfig;
      bookTitle: string;
      shortDescription: string;
      zoneStyle: string;
      reason: string;
    }> = [];
    const skipResults: Array<{ user: string; action: string; reason: string; success: boolean }> = [];
    const usedTitles = new Set<string>();

    for (let i = 0; i < decisions.length; i++) {
      const result = decisions[i];
      const user = users[i];

      if (result.status === 'fulfilled' && result.value.success && result.value.decision === 'join') {
        const { bookTitle, zoneStyle, reason } = result.value;

        if (bookTitle && zoneStyle) {
          // 清理书名格式并确保唯一
          const cleanTitle = bookTitle.replace(/《|》/g, '');
          let finalTitle = cleanTitle;
          let counter = 1;
          while (usedTitles.has(finalTitle)) {
            finalTitle = `${cleanTitle}_${counter++}`;
          }
          usedTitles.add(finalTitle);

          joinResults.push({
            user,
            config: result.value.config,
            bookTitle: finalTitle,
            shortDescription: result.value.shortDescription || '',
            zoneStyle,
            reason,
          });

          console.log(`[StartSeason]   → ${user.nickname} 参赛：《${finalTitle}》`);
          continue;
        }
      }

      // 弃权或失败的
      const reason = result.status === 'fulfilled'
        ? result.value.reason
        : `异常: ${result.reason}`;
      skipResults.push({
        user: user.nickname,
        action: '弃权',
        reason,
        success: false,
      });
      console.log(`[StartSeason]   → ${user.nickname} 弃权：${reason}`);
    }

    // 7. 并发创建书籍（决策通过的）
    console.log(`[StartSeason] 并发创建 ${joinResults.length} 本书籍...`);

    const bookPromises = joinResults.map(async (joinResult) => {
      const { user, bookTitle, shortDescription, zoneStyle } = joinResult;
      const zoneCn = normalizeZoneStyle(zoneStyle);

      try {
        // 检查用户是否已有本书季的书籍
        const existingBook = await prisma.book.findFirst({
          where: {
            authorId: user.id,
            seasonId: season.id,
          },
        });

        if (existingBook) {
          console.log(`[StartSeason] 用户 ${user.nickname} 已参赛，跳过`);
          return { user, book: existingBook, success: true as const, skipped: true };
        }

        // 创建书籍
        const book = await prisma.book.create({
          data: {
            title: bookTitle,
            shortDesc: shortDescription || '暂无简介',
            zoneStyle: zoneCn,
            authorId: user.id,
            seasonId: season.id,
            status: 'ACTIVE',
            inkBalance: 50,
            // 评分字段已在 Book 表中初始化（默认值为0）
          },
        });

        console.log(`[StartSeason]   [成功] 《${bookTitle}》创建成功`);
        return { user, book, success: true as const, skipped: false };
      } catch (error) {
        console.error(`[StartSeason]   [失败] 创建书籍《${bookTitle}》失败:`, error);
        return { user, bookTitle, reason: error, success: false as const };
      }
    });

    const books = await Promise.allSettled(bookPromises);

    // 统计结果
    let joinCount = 0;
    let skipCount = skipResults.length;
    const results: Array<{
      user: string;
      action: string;
      bookTitle?: string;
      success: boolean;
      reason?: string;
    }> = [];

    for (const bookResult of books) {
      if (bookResult.status === 'fulfilled' && bookResult.value.success) {
        if (!bookResult.value.skipped) {
          joinCount++;
        }
        results.push({
          user: bookResult.value.user.nickname,
          action: bookResult.value.skipped ? '已参赛' : '参赛',
          bookTitle: bookResult.value.book?.title || 'N/A',
          success: true,
        });
      } else {
        // 失败的情况
        skipCount++;
        // 从 rejected 中获取原因
        const reason = bookResult.status === 'rejected'
          ? bookResult.reason
          : (bookResult.value as { reason?: unknown })?.reason || '未知错误';
        results.push({
          user: (bookResult.status === 'fulfilled' ? (bookResult.value as { user?: { nickname: string } })?.user?.nickname : 'Unknown') || 'Unknown',
          action: '失败',
          reason: String(reason),
          success: false,
        });
      }
    }

    // 添加弃权的结果
    results.push(...skipResults);

    // 8. 更新赛季参与人数
    const participantCount = await prisma.book.count({
      where: { seasonId: season.id },
    });

    await prisma.season.update({
      where: { id: season.id },
      data: { participantCount },
    });

    // 9. 启动自动推进服务
    console.log('[StartSeason] 启动自动推进服务...');
    const { seasonAutoAdvanceService } = await import('@/services/season-auto-advance.service');
    await seasonAutoAdvanceService.start();

    console.log(`[StartSeason] 赛季开始完成！参赛: ${joinCount}, 弃权: ${skipCount}`);

    return NextResponse.json({
      code: 0,
      data: {
        seasonId: season.id,
        seasonNumber: season.seasonNumber,
        themeKeyword: season.themeKeyword,
        totalAgents: users.length,
        joinCount,
        skipCount,
        participantCount,
        results,
      },
      message: `赛季开始！${joinCount} 个 Agent 参赛，${skipCount} 个弃权`,
    });
  } catch (error) {
    console.error('[StartSeason] 错误:', error);
    return NextResponse.json(
      { code: 500, data: null, message: '开始赛季失败: ' + (error as Error).message },
      { status: 500 }
    );
  }
}
