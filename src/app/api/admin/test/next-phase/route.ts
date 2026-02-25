/**
 * 赛季阶段推进 API
 * POST /api/admin/test/next-phase
 *
 * 手动推进赛季到下一阶段
 */

import { NextRequest, NextResponse } from 'next/server';
import { RoundPhase } from '@/types/season';
import { requireAdmin, createUnauthorizedResponse, createForbiddenResponse } from '@/lib/utils/admin';
import { getActiveSeason, getPhaseDisplayName, getPhaseDescription } from '@/lib/utils/season-utils';
import { advanceToNextPhase, getSeasonPhaseStatus, PhaseAdvanceResult } from '@/services/season-phase.service';
import { SEASON_DEFAULTS } from '@/config/season.constants';

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

    const body = await request.json();
    const { action = 'NEXT_PHASE' } = body;

    console.log(`[NextPhase] 收到阶段推进请求: ${action}`);

    // 2. 获取当前活跃赛季
    const season = await getActiveSeason();

    if (!season) {
      return NextResponse.json({
        code: 400,
        data: null,
        message: '没有正在进行的赛季',
      });
    }

    // 3. 解析当前状态
    const currentRound = season.currentRound || 1;
    const currentPhase = (season.roundPhase as RoundPhase) || 'NONE';

    console.log(`[NextPhase] 当前状态: 第 ${currentRound} 轮, 阶段=${currentPhase}`);

    // 4. 执行阶段推进
    const result = await advanceToNextPhase(season.id, currentRound, currentPhase, action);

    // 5. 检查是否是结束赛季
    if ('action' in result && (result.action === 'SEASON_ENDED' || result.action === 'MAX_ROUND_REACHED')) {
      return NextResponse.json({
        code: 0,
        data: {
          seasonId: season.id,
          seasonNumber: season.seasonNumber,
          action: result.action,
          message: result.message,
        },
        message: result.message,
      });
    } else {
      // 6. 返回成功结果
      const advanceResult = result as PhaseAdvanceResult;
      console.log(`[NextPhase] 推进到: 第 ${advanceResult.currentRound} 轮 - ${getPhaseDisplayName(advanceResult.currentPhase)}`);

      return NextResponse.json({
        code: 0,
        data: {
          seasonId: advanceResult.seasonId,
          seasonNumber: advanceResult.seasonNumber,
          currentRound: advanceResult.currentRound,
          currentPhase: advanceResult.currentPhase,
          phaseDisplayName: getPhaseDisplayName(advanceResult.currentPhase),
          phaseDescription: getPhaseDescription(advanceResult.currentPhase, season.roundDuration ?? SEASON_DEFAULTS.DEFAULT_ROUND_DURATION),
          action: advanceResult.action,
          bookCount: advanceResult.bookCount,
          task: advanceResult.task,
          books: advanceResult.books,
        },
        message: `已推进到第 ${advanceResult.currentRound} 轮 - ${getPhaseDisplayName(advanceResult.currentPhase)}${advanceResult.task ? '，' + advanceResult.task.message : ''}`,
      });
    }
  } catch (error) {
    console.error('[NextPhase] 错误:', error);
    return NextResponse.json(
      { code: 500, data: null, message: '阶段推进失败: ' + (error as Error).message },
      { status: 500 }
    );
  }
}

// 获取当前阶段状态
export async function GET() {
  try {
    const season = await getActiveSeason();

    if (!season) {
      return NextResponse.json({
        code: 0,
        data: null,
        message: '没有正在进行的赛季',
      });
    }

    const status = await getSeasonPhaseStatus(season.id);

    if (!status) {
      return NextResponse.json({
        code: 0,
        data: null,
        message: '没有正在进行的赛季',
      });
    }

    return NextResponse.json({
      code: 0,
      data: status,
      message: '获取成功',
    });
  } catch (error) {
    console.error('[NextPhase] 获取状态错误:', error);
    return NextResponse.json(
      { code: 500, data: null, message: '获取状态失败: ' + (error as Error).message },
      { status: 500 }
    );
  }
}
