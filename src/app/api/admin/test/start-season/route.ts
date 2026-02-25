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
import { requireAdmin, createUnauthorizedResponse, createForbiddenResponse } from '@/lib/utils/admin';
import { getActiveSeason, getSeasonInfo, updateSeasonParticipantCount } from '@/lib/utils/season-utils';
import { getAgentDecisions, createBooksFromDecisions, createSeason } from '@/services/agent-decision.service';
import { SEASON_DEFAULTS } from '@/config/season.constants';

/**
 * 赛季开始请求处理
 */
async function handleStartSeason(params: {
  seasonNumber?: number;
  themeKeyword?: string;
  constraints?: string[];
  zoneStyles?: string[];
  maxChapters?: number;
  minChapters?: number;
  roundDuration?: number;
  rewards?: Record<string, number>;
}) {
  const {
    seasonNumber,
    themeKeyword = SEASON_DEFAULTS.DEFAULT_THEME,
    constraints = [...SEASON_DEFAULTS.DEFAULT_CONSTRAINTS] as string[],
    zoneStyles = [...SEASON_DEFAULTS.DEFAULT_ZONE_STYLES] as string[],
    maxChapters = SEASON_DEFAULTS.DEFAULT_MAX_CHAPTERS,
    minChapters = SEASON_DEFAULTS.DEFAULT_MIN_CHAPTERS,
    roundDuration = SEASON_DEFAULTS.DEFAULT_ROUND_DURATION,
    rewards = SEASON_DEFAULTS.DEFAULT_REWARDS,
  } = params;

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

  // 1. 获取所有 Agent
  const users = await prisma.user.findMany({
    where: {
      agentConfig: { not: null as unknown as undefined },
    },
    orderBy: { createdAt: 'asc' },
  });

  if (users.length === 0) {
    throw new Error('没有找到 Agent，请确保有用户配置了 Agent');
  }

  console.log(`[StartSeason] 找到 ${users.length} 个 Agent`);

  // 2. 检查或创建赛季
  let season = await getActiveSeason();

  if (!season) {
    // 创建新赛季
    season = await createSeason({
      seasonNumber,
      themeKeyword,
      constraints,
      zoneStyles,
      maxChapters,
      minChapters,
      roundDuration,
      rewards,
    });
    console.log(`[StartSeason] 创建新赛季: S${season.seasonNumber} - ${season.themeKeyword}`);
  } else {
    console.log(`[StartSeason] 使用已有赛季: S${season.seasonNumber}`);
  }

  // 3. 获取赛季信息
  const seasonInfo = getSeasonInfo(season);
  if (!seasonInfo) {
    throw new Error('无法获取赛季信息');
  }

  // 4. 并发获取所有 Agent 的参赛决策
  console.log(`[StartSeason] 向 ${users.length} 个 Agent 并发发送赛季邀请...`);
  const decisions = await getAgentDecisions(seasonInfo);

  // 5. 处理决策结果
  const joinResults: Array<{
    user: { nickname: string };
    success: boolean;
    decision: string;
    bookTitle?: string;
    reason: string;
  }> = [];
  const skipResults: Array<{ user: string; action: string; reason: string; success: boolean }> = [];
  const usedTitles = new Set<string>();

  for (const result of decisions) {
    if (result.success && result.decision === 'join' && result.bookTitle && result.zoneStyle) {
      const cleanTitle = result.bookTitle.replace(/《|》/g, '');
      let finalTitle = cleanTitle;
      let counter = 1;
      while (usedTitles.has(finalTitle)) {
        finalTitle = `${cleanTitle}_${counter++}`;
      }
      usedTitles.add(finalTitle);

      joinResults.push({
        user: result.user,
        success: true,
        decision: 'join',
        bookTitle: finalTitle,
        reason: result.reason,
      });
      console.log(`[StartSeason]   → ${result.user.nickname} 参赛：《${finalTitle}》`);
    } else {
      skipResults.push({
        user: result.user.nickname,
        action: '弃权',
        reason: result.reason,
        success: false,
      });
      console.log(`[StartSeason]   → ${result.user.nickname} 弃权：${result.reason}`);
    }
  }

  // 6. 创建书籍
  console.log(`[StartSeason] 并发创建 ${joinResults.length} 本书籍...`);
  const transformedDecisions = decisions.map(d => ({
    user: d.user,
    config: d.config,
    success: d.success,
    decision: d.decision as 'join' | 'skip',
    bookTitle: d.bookTitle,
    shortDescription: d.shortDescription,
    zoneStyle: d.zoneStyle,
    reason: d.reason,
  }));

  const { bookResults, joinCount, skipCount } = await createBooksFromDecisions(
    season.id,
    transformedDecisions
  );

  // 7. 统计结果
  const results: Array<{
    user: string;
    action: string;
    bookTitle?: string;
    success: boolean;
    reason?: string;
  }> = [];

  for (const bookResult of bookResults) {
    if (bookResult.status === 'fulfilled' && bookResult.value.success) {
      results.push({
        user: bookResult.value.user.nickname,
        action: bookResult.value.skipped ? '已参赛' : '参赛',
        bookTitle: bookResult.value.book?.title || 'N/A',
        success: true,
      });
    } else {
      results.push({
        user: (bookResult.status === 'fulfilled'
          ? bookResult.value.user?.nickname
          : 'Unknown') || 'Unknown',
        action: '失败',
        reason: String(bookResult.status === 'rejected'
          ? bookResult.reason
          : (bookResult.value as { reason?: unknown })?.reason || '未知错误'),
        success: false,
      });
    }
  }

  results.push(...skipResults);

  // 8. 更新赛季参与人数
  await updateSeasonParticipantCount(season.id);

  return {
    seasonId: season.id,
    seasonNumber: season.seasonNumber,
    themeKeyword: season.themeKeyword,
    totalAgents: users.length,
    joinCount,
    skipCount,
    results,
  };
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

    // 2. 获取并验证请求参数
    const body = await request.json().catch(() => ({}));

    // 3. 执行赛季开始逻辑
    const result = await handleStartSeason(body);

    // 4. 启动自动推进服务
    console.log('[StartSeason] 启动自动推进服务...');
    const { seasonAutoAdvanceService } = await import('@/services/season-auto-advance.service');
    await seasonAutoAdvanceService.start();

    const participantCount = await prisma.book.count({
      where: { seasonId: result.seasonId },
    });

    console.log(`[StartSeason] 赛季开始完成！参赛: ${result.joinCount}, 弃权: ${result.skipCount}`);

    return NextResponse.json({
      code: 0,
      data: {
        seasonId: result.seasonId,
        seasonNumber: result.seasonNumber,
        themeKeyword: result.themeKeyword,
        totalAgents: result.totalAgents,
        joinCount: result.joinCount,
        skipCount: result.skipCount,
        participantCount,
        results: result.results,
      },
      message: `赛季开始！${result.joinCount} 个 Agent 参赛，${result.skipCount} 个弃权`,
    });
  } catch (error) {
    console.error('[StartSeason] 错误:', error);
    return NextResponse.json(
      { code: 500, data: null, message: '开始赛季失败: ' + (error as Error).message },
      { status: 500 }
    );
  }
}
