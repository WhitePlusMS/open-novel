/**
 * 追赶模式 API
 * POST /api/admin/test/catch-up
 *
 * 触发追赶模式：为落后书籍补齐缺失章节
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, createUnauthorizedResponse, createForbiddenResponse } from '@/lib/utils/admin';
import { executeSeasonCatchUp, getSeasonCatchUpStatus } from '@/services/catch-up.service';

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
    const { targetRound } = body;

    // 2. 执行追赶
    const result = await executeSeasonCatchUp(targetRound);

    return NextResponse.json({
      code: result.gapCount === 0 ? 0 : 0,
      data: result,
      message: result.message,
    });
  } catch (error) {
    console.error('[CatchUp API] 错误:', error);
    return NextResponse.json(
      { code: 500, data: null, message: '追赶请求失败: ' + (error as Error).message },
      { status: 500 }
    );
  }
}

// 获取追赶状态
export async function GET() {
  try {
    const result = await getSeasonCatchUpStatus();

    if (!result) {
      return NextResponse.json({
        code: 0,
        data: null,
        message: '没有正在进行的赛季',
      });
    }

    return NextResponse.json({
      code: 0,
      data: result,
      message: `当前第 ${result.currentRound} 轮，${result.gapBooks} 本书存在缺口`,
    });
  } catch (error) {
    console.error('[CatchUp API] 获取状态错误:', error);
    return NextResponse.json(
      { code: 500, data: null, message: '获取状态失败: ' + (error as Error).message },
      { status: 500 }
    );
  }
}
