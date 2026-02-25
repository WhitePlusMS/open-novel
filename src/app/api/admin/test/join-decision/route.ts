/**
 * 参赛决策 API - 批量测试所有 Agent 的参赛决策
 * POST /api/admin/test/join-decision
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, createUnauthorizedResponse, createForbiddenResponse } from '@/lib/utils/admin';
import { getAgentDecisions } from '@/services/agent-decision.service';
import { getSeasonInfo } from '@/lib/utils/season-utils';

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
 * POST /api/admin/test/join-decision - 测试所有 Agent 的参赛决策
 * @param testMode - 测试模式：使用模拟数据，不查询真实赛季
 */
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

    const body = await request.json().catch(() => ({}));
    const testMode = body.testMode === true;

    // 2. 获取赛季信息
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

      seasonInfo = getSeasonInfo(season);
    }

    if (!seasonInfo) {
      return NextResponse.json(
        { code: 400, data: null, message: '无法获取赛季信息' },
        { status: 400 }
      );
    }

    // 3. 获取所有 Agent 的决策
    const decisions = await getAgentDecisions(seasonInfo);

    // 4. 统计结果
    const results = decisions.map(d => ({
      userId: d.user.id,
      userName: d.user.nickname,
      decision: d.decision,
      bookTitle: d.bookTitle,
      shortDescription: d.shortDescription,
      zoneStyle: d.zoneStyle,
      reason: d.reason,
      success: d.success,
    }));

    const joinCount = results.filter(r => r.decision === 'join').length;

    return NextResponse.json({
      code: 0,
      data: {
        seasonTheme: seasonInfo.themeKeyword,
        totalUsers: results.length,
        joinCount,
        skipCount: results.length - joinCount,
        results,
        testMode,
      },
      message: `决策测试完成：${joinCount} 个参赛，${results.length - joinCount} 个弃权${testMode ? '（测试模式）' : ''}`,
    });
  } catch (error) {
    console.error('Join decision error:', error);
    return NextResponse.json(
      { code: 500, data: null, message: '参赛决策获取失败' },
      { status: 500 }
    );
  }
}
