// 参赛决策 API - 批量测试所有 Agent 的参赛决策
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { testModeSendChat } from '@/lib/secondme/client';
import { parseLLMJsonWithRetry } from '@/lib/utils/llm-parser';
import { safeJsonField } from '@/lib/utils/jsonb-utils';

// 模拟测试数据
const TEST_SEASON_DATA = {
  seasonNumber: 99,
  themeKeyword: '赛博大唐',
  constraints: ['不能出现真实地名', '主角必须有成长弧线'],
  zoneStyles: ['urban', 'fantasy', 'scifi'],
  rewards: { first: 1000, second: 500, third: 200 },
  minChapters: 3,
  maxChapters: 5,
};

/**
 * 从 writerPersonality 中提取核心性格描述
 * 过滤掉"兴趣标签"等额外信息
 */
function extractCorePersonality(personality: string): string {
  if (!personality) return '性格多变';

  // 如果包含"兴趣标签："，只取其前面的部分
  const corePart = personality.split('兴趣标签：')[0].trim();

  // 清理多余的空白和换行
  const cleaned = corePart.replace(/\s+/g, ' ').trim();

  return cleaned || '性格多变';
}

/**
 * 将写作长短偏好转换为创作偏好描述
 */
function getChapterPreference(preference: string | undefined): string {
  if (preference === 'short') return '短篇小说';
  if (preference === 'long') return '长篇小说';
  return '中篇小说';
}

/**
 * POST /api/admin/test/join-decision - 测试所有 Agent 的参赛决策
 * @param testMode - 测试模式：使用模拟数据，不查询真实赛季
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const testMode = body.testMode === true;

    // 获取赛季信息
    let seasonInfo;
    if (testMode) {
      console.log(`[JoinDecision] 测试模式：使用模拟赛季数据`);
      seasonInfo = TEST_SEASON_DATA;
    } else {
      const season = await prisma.season.findFirst({
        where: { status: 'ACTIVE' },
      });

      if (!season) {
        return NextResponse.json(
          { code: 400, data: null, message: '没有进行中的赛季' },
          { status: 400 }
        );
      }

      seasonInfo = {
        seasonNumber: season.seasonNumber,
        themeKeyword: season.themeKeyword,
        constraints: JSON.parse((season.constraints as unknown as string) || '[]'),
        zoneStyles: JSON.parse((season.zoneStyles as unknown as string) || '[]'),
        rewards: JSON.parse((season.rewards as unknown as string) || '{}'),
        minChapters: season.minChapters,
        maxChapters: season.maxChapters,
      };
    }

    // 获取所有有 Agent 配置的用户
    const users = await prisma.user.findMany({
      where: {
        agentConfig: { not: null as unknown as undefined },
      },
    });

    if (users.length === 0) {
      return NextResponse.json(
        { code: 400, data: null, message: '没有找到有 Agent 配置的用户' },
        { status: 400 }
      );
    }

    // 构建决策 Prompt
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

    // 批量处理每个用户的决策
    const results = [];
    for (const user of users) {
      const config = safeJsonField(user.agentConfig, {
        writerPersonality: '',
        writingStyle: '',
        writingLengthPreference: 'medium',
        adaptability: 0.5,
        description: user.nickname,
        preferredGenres: [],
        wordCountTarget: 2000,
      });

      // 构建 System Prompt
      const corePersonality = extractCorePersonality(config.writerPersonality);
      const chapterPreference = getChapterPreference(config.writingLengthPreference);
      const wordCount = config.wordCountTarget || 2000;

      const systemPrompt = `你是一名作家，具有以下性格特征：
- 性格：${corePersonality}
- 写作风格：${config.writingStyle || '多变'}
- 听劝指数：${config.adaptability ?? 0.5}（越高越会采纳读者意见）
- 偏好题材：${config.preferredGenres?.join('、') || '不限'}
- 创作偏好：${chapterPreference}，每章约 ${wordCount} 字

重要：直接输出 JSON 对象，不要用任何符号包裹，不要有解释性文字！`;

      try {
        const parsed = await parseLLMJsonWithRetry<{
          decision: string;
          bookTitle?: string;
          shortDescription?: string;
          zoneStyle?: string;
          reason: string;
        }>(
          () => testModeSendChat(userMessage, systemPrompt, 'inksurvivor-season'),
          {
            taskId: `JoinDecision-${user.nickname}`,
            maxRetries: 3,
          }
        );

        results.push({
          userId: user.id,
          userName: user.nickname,
          decision: parsed.decision,
          bookTitle: parsed.bookTitle,
          shortDescription: parsed.shortDescription,
          zoneStyle: parsed.zoneStyle,
          reason: parsed.reason,
          success: true,
        });
      } catch (error) {
        console.error(`[JoinDecision] LLM 调用失败:`, error);
        results.push({
          userId: user.id,
          userName: user.nickname,
          decision: 'skip',
          reason: `决策失败: ${(error as Error).message}`,
          success: false,
        });
      }
    }

    const joinCount = results.filter(r => r.decision === 'join').length;

    return NextResponse.json({
      code: 0,
      data: {
        seasonTheme: seasonInfo.themeKeyword,
        totalUsers: users.length,
        joinCount,
        skipCount: users.length - joinCount,
        results,
        testMode,
      },
      message: `决策测试完成：${joinCount} 个参赛，${users.length - joinCount} 个弃权${testMode ? '（测试模式）' : ''}`,
    });
  } catch (error) {
    console.error('Join decision error:', error);
    return NextResponse.json(
      { code: 500, data: null, message: '参赛决策获取失败' },
      { status: 500 }
    );
  }
}
