/**
 * 单本书章节补全 API
 * POST /api/books/[id]/catch-up
 *
 * 检查书籍是否需要补全章节，并根据最新大纲补全缺失章节
 * 用户手动点击按钮触发，不走任务队列
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { getCatchUpStatus, executeCatchUp } from '@/services/catch-up.service';
import { createUnauthorizedResponse } from '@/lib/utils/admin';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: bookId } = await params;

    // 1. 获取当前登录用户
    const cookieStore = await cookies();
    const authToken = cookieStore.get('auth_token')?.value;

    if (!authToken) {
      return NextResponse.json(createUnauthorizedResponse('请先登录'), { status: 401 });
    }

    // 2. 获取书籍信息
    const book = await prisma.book.findUnique({
      where: { id: bookId },
      select: { authorId: true, title: true },
    });

    if (!book) {
      return NextResponse.json({
        code: 404,
        data: null,
        message: '书籍不存在',
      });
    }

    // 3. 验证是否是书籍的作者
    if (book.authorId !== authToken) {
      return NextResponse.json({
        code: 403,
        data: null,
        message: '只有作者才能补全章节',
      });
    }

    // 4. 获取目标轮次
    const season = await prisma.season.findFirst({
      where: { status: 'ACTIVE' },
      orderBy: { startTime: 'desc' },
      select: { currentRound: true },
    });

    const targetRound = season?.currentRound || 1;

    // 5. 执行追赶
    console.log(`[CatchUp] 书籍《${book.title}》补全请求，targetRound: ${targetRound}`);
    const result = await executeCatchUp(bookId, targetRound);

    // 6. 获取状态
    const status = await getCatchUpStatus(bookId);

    return NextResponse.json({
      code: result.success ? 0 : 400,
      data: {
        hasOutline: status.hasOutline,
        outlineChapters: status.outlineChapters,
        existingChapters: status.existingChapters,
        missingChapters: status.missingChapters,
        targetRound: status.targetRound,
        maxOutlineChapter: status.maxOutlineChapter,
        needsCatchUp: status.needsCatchUp,
        message: result.message,
      },
      message: result.message,
    });
  } catch (error) {
    console.error('[CatchUp API] 错误:', error);
    return NextResponse.json(
      { code: 500, data: null, message: '补全请求失败: ' + (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/books/[id]/catch-up
 *
 * 获取书籍章节补全状态
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: bookId } = await params;

    // 1. 获取书籍信息
    const book = await prisma.book.findUnique({
      where: { id: bookId },
      select: { title: true },
    });

    if (!book) {
      return NextResponse.json({
        code: 404,
        data: null,
        message: '书籍不存在',
      });
    }

    // 2. 获取追赶状态
    const status = await getCatchUpStatus(bookId);

    return NextResponse.json({
      code: 0,
      data: status,
      message: status.needsCatchUp
        ? `缺少 ${status.missingChapters.length} 个章节`
        : '章节已完整',
    });
  } catch (error) {
    console.error('[CatchUp API] GET 错误:', error);
    return NextResponse.json(
      { code: 500, data: null, message: '获取状态失败: ' + (error as Error).message },
      { status: 500 }
    );
  }
}
