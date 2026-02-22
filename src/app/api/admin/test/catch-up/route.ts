/**
 * 追赶模式 API
 * POST /api/admin/test/catch-up
 *
 * 触发追赶模式：为落后书籍补齐缺失章节
 *
 * 场景：赛季已进行到第 N 轮，但某些书籍只创作到第 M 章 (M < N)
 * 触发后：生成大纲 + 并发补齐第 M+1 到第 N 章
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { chapterWritingService } from '@/services/chapter-writing.service';
import { requireAdmin, createUnauthorizedResponse, createForbiddenResponse } from '@/lib/utils/admin';

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

    // 1. 获取当前活跃赛季
    const season = await prisma.season.findFirst({
      where: { status: 'ACTIVE' },
      orderBy: { startTime: 'desc' },
    });

    if (!season) {
      return NextResponse.json({
        code: 400,
        data: null,
        message: '没有正在进行的赛季',
      });
    }

    // 2. 确定目标轮次
    const currentRound = season.currentRound || 1;
    const round = targetRound || currentRound;

    console.log(`[CatchUp API] 收到追赶请求 - 当前轮次: ${currentRound}, 目标轮次: ${round}`);

    await chapterWritingService.recordRoundGaps(season.id, round, 'ADMIN');

    const gaps = await prisma.roundGap.findMany({
      where: {
        seasonId: season.id,
        round,
        status: 'OPEN',
      },
      include: {
        book: {
          select: {
            id: true,
            title: true,
            author: { select: { nickname: true } },
          },
        },
      },
    });

    const gapByBook = new Map<string, { id: string; title: string; author: string; chapterGaps: number[]; outlineGaps: number[] }>();
    gaps.forEach((gap) => {
      const existing = gapByBook.get(gap.bookId) ?? {
        id: gap.bookId,
        title: gap.book.title,
        author: gap.book.author.nickname,
        chapterGaps: [],
        outlineGaps: [],
      };
      if (gap.gapType === 'CHAPTER') {
        existing.chapterGaps.push(gap.chapterNumber);
      } else {
        existing.outlineGaps.push(gap.chapterNumber);
      }
      gapByBook.set(gap.bookId, existing);
    });

    const gapBooks = Array.from(gapByBook.values()).map((item) => ({
      ...item,
      chapterGaps: Array.from(new Set(item.chapterGaps)).sort((a, b) => a - b),
      outlineGaps: Array.from(new Set(item.outlineGaps)).sort((a, b) => a - b),
    }));

    console.log(`[CatchUp API] 当前第 ${round} 轮，发现 ${gapBooks.length} 本存在缺口书籍`);

    if (gaps.length === 0) {
      return NextResponse.json({
        code: 0,
        data: {
          seasonId: season.id,
          seasonNumber: season.seasonNumber,
          currentRound,
          targetRound: round,
          gapCount: 0,
          message: '没有缺口需要补齐',
        },
        message: '没有缺口需要补齐',
      });
    }

    // 4. 异步触发补漏（不阻塞 API 响应）
    setTimeout(async () => {
      try {
        await chapterWritingService.resolveRoundGaps(season.id, round);
      } catch (error) {
        console.error('[CatchUp API] 补漏任务失败:', error);
      }
    }, 100);

    // 5. 返回响应
    return NextResponse.json({
      code: 0,
      data: {
        seasonId: season.id,
        seasonNumber: season.seasonNumber,
        currentRound,
        targetRound: round,
        gapCount: gaps.length,
        books: gapBooks,
        message: `正在为第 ${round} 轮缺口执行补漏`,
      },
      message: `已触发补漏任务，正在处理第 ${round} 轮缺口`,
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
    const season = await prisma.season.findFirst({
      where: { status: 'ACTIVE' },
      orderBy: { startTime: 'desc' },
    });

    if (!season) {
      return NextResponse.json({
        code: 0,
        data: null,
        message: '没有正在进行的赛季',
      });
    }

    const currentRound = season.currentRound || 1;

    const gaps = await prisma.roundGap.findMany({
      where: {
        seasonId: season.id,
        round: currentRound,
        status: 'OPEN',
      },
      include: {
        book: {
          select: {
            id: true,
            title: true,
            author: { select: { nickname: true } },
          },
        },
      },
    });

    const gapByBook = new Map<string, { id: string; title: string; author: string; chapterGaps: number[]; outlineGaps: number[] }>();
    gaps.forEach((gap) => {
      const existing = gapByBook.get(gap.bookId) ?? {
        id: gap.bookId,
        title: gap.book.title,
        author: gap.book.author.nickname,
        chapterGaps: [],
        outlineGaps: [],
      };
      if (gap.gapType === 'CHAPTER') {
        existing.chapterGaps.push(gap.chapterNumber);
      } else {
        existing.outlineGaps.push(gap.chapterNumber);
      }
      gapByBook.set(gap.bookId, existing);
    });

    const gapDetails = Array.from(gapByBook.values()).map((item) => ({
      ...item,
      chapterGaps: Array.from(new Set(item.chapterGaps)).sort((a, b) => a - b),
      outlineGaps: Array.from(new Set(item.outlineGaps)).sort((a, b) => a - b),
    }));

    return NextResponse.json({
      code: 0,
      data: {
        seasonId: season.id,
        seasonNumber: season.seasonNumber,
        currentRound,
        gapCount: gaps.length,
        gapBooks: gapDetails.length,
        gapDetails,
      },
      message: `当前第 ${currentRound} 轮，${gapDetails.length} 本书存在缺口`,
    });
  } catch (error) {
    console.error('[CatchUp API] 获取状态错误:', error);
    return NextResponse.json(
      { code: 500, data: null, message: '获取状态失败: ' + (error as Error).message },
      { status: 500 }
    );
  }
}
