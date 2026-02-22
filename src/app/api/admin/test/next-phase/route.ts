/**
 * 赛季阶段推进 API
 * POST /api/admin/test/next-phase
 *
 * 手动推进赛季到下一阶段
 *
 * 阶段流程（简化版 - 两个阶段）：
 * - AI_WORKING (AI创作期): Agent 生成大纲和章节
 * - HUMAN_READING (人类阅读期): 读者阅读章节
 *
 * 推进逻辑：
 * NONE -> AI_WORKING -> HUMAN_READING -> AI_WORKING (下一轮) -> ...
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { RoundPhase } from '@/types/season';
import { taskQueueService } from '@/services/task-queue.service';
import { seasonAutoAdvanceService } from '@/services/season-auto-advance.service';
import { requireAdmin, createUnauthorizedResponse, createForbiddenResponse } from '@/lib/utils/admin';

// 阶段顺序
const PHASE_ORDER: RoundPhase[] = ['AI_WORKING', 'HUMAN_READING'];

// 获取下一阶段
function getNextPhase(currentPhase: RoundPhase): RoundPhase {
  const currentIndex = PHASE_ORDER.indexOf(currentPhase);
  if (currentIndex === -1) return 'AI_WORKING'; // 默认开始AI创作期
  if (currentIndex >= PHASE_ORDER.length - 1) {
    return 'AI_WORKING'; // 下一轮开始
  }
  return PHASE_ORDER[currentIndex + 1];
}

// 获取阶段显示名称
function getPhaseDisplayName(phase: RoundPhase): string {
  const names: Record<RoundPhase, string> = {
    NONE: '未开始',
    AI_WORKING: 'AI创作期',
    HUMAN_READING: '人类阅读期',
  };
  return names[phase] || phase;
}

// 获取阶段说明（动态获取配置的时长）
function getPhaseDescription(phase: RoundPhase, roundDuration?: number): string {
  // 使用 roundDuration 计算各阶段时长
  const totalMinutes = roundDuration || 20;
  // AI_WORKING 阶段占总时长的 40%（包含大纲和创作），HUMAN_READING 占 60%
  const aiWorkingMinutes = Math.round(totalMinutes * 0.4);
  const humanReadingMinutes = Math.round(totalMinutes * 0.6);

  const descriptions: Record<RoundPhase, string> = {
    NONE: '赛季准备中',
    AI_WORKING: `Agent 生成大纲和章节（${aiWorkingMinutes}分钟）`,
    HUMAN_READING: `读者阅读章节（${humanReadingMinutes}分钟）`,
  };
  return descriptions[phase] || phase;
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

    const body = await request.json();
    const { action = 'NEXT_PHASE' } = body;

    console.log(`[NextPhase] 收到阶段推进请求: ${action}`);

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

    // 2. 解析当前状态
    const currentRound = season.currentRound || 1;  // 轮次从 1 开始
    const currentPhase = (season.roundPhase as RoundPhase) || 'NONE';
    const maxChapters = season.maxChapters || 7;

    console.log(`[NextPhase] 当前状态: 第 ${currentRound} 轮, 阶段=${currentPhase}`);

    let nextPhase: RoundPhase;
    let nextRound = currentRound;

    if (action === 'END_SEASON') {
      // 结束赛季
      await prisma.season.update({
        where: { id: season.id },
        data: {
          status: 'FINISHED',
          roundPhase: 'NONE',
          endTime: new Date(),
        },
      });

      return NextResponse.json({
        code: 0,
        data: {
          seasonId: season.id,
          seasonNumber: season.seasonNumber,
          action: 'SEASON_ENDED',
          message: '赛季已结束',
        },
        message: '赛季已结束',
      });
    }

    // 计算下一阶段和轮次
    if (currentPhase === 'NONE') {
      nextPhase = 'AI_WORKING';
    } else if (currentPhase === 'HUMAN_READING') {
      nextPhase = 'AI_WORKING';
      nextRound = currentRound + 1;
    } else {
      nextPhase = getNextPhase(currentPhase);
    }

    // 最大轮次 = 最大章节数（每轮创作一章）
    const maxRounds = maxChapters;

    // 4. 检查是否超过最大轮次
    if (nextRound > maxRounds) {
      // 自动结束赛季
      console.log(`[NextPhase] 已达最大轮次（第 ${maxRounds} 轮），自动结束赛季`);

      await prisma.season.update({
        where: { id: season.id },
        data: {
          status: 'FINISHED',
          roundPhase: 'NONE',
          endTime: new Date(),
        },
      });

      return NextResponse.json({
        code: 0,
        data: {
          seasonId: season.id,
          seasonNumber: season.seasonNumber,
          action: 'SEASON_ENDED',
          message: `第 ${maxRounds} 轮结束，赛季已自动结束`,
        },
        message: `第 ${maxRounds} 轮结束，赛季已自动结束`,
      });
    }

    let taskResult: { type: string; message: string } | null = null;

    if (currentPhase === 'AI_WORKING' && nextPhase === 'HUMAN_READING') {
      const runningTask = await prisma.taskQueue.findFirst({
        where: {
          taskType: 'ROUND_CYCLE',
          status: { in: ['PENDING', 'PROCESSING'] },
          seasonId: season.id,
          round: currentRound,
        },
      });
      const roundRecord = await prisma.seasonRound.findUnique({
        where: { seasonId_round: { seasonId: season.id, round: currentRound } },
      });
      if (runningTask || (roundRecord && !roundRecord.endedAt)) {
        return NextResponse.json({
          code: 400,
          data: null,
          message: '当前轮次任务仍在执行，无法手动切换阶段',
        });
      }
      await seasonAutoAdvanceService.advanceToNextRound(season.id, currentRound);
      taskResult = { type: 'PHASE_SWITCH', message: '已切换到 HUMAN_READING' };
    } else if (nextPhase === 'AI_WORKING') {
      if (currentPhase === 'HUMAN_READING') {
        const roundRecord = await prisma.seasonRound.findUnique({
          where: { seasonId_round: { seasonId: season.id, round: currentRound } },
        });
        if (roundRecord && !roundRecord.endedAt) {
          return NextResponse.json({
            code: 400,
            data: null,
            message: '当前轮次未完成收尾，无法进入下一轮',
          });
        }
      }
      const roundStartTime = new Date();
      await prisma.season.update({
        where: { id: season.id },
        data: {
          currentRound: nextRound,
          roundPhase: 'AI_WORKING',
          roundStartTime: roundStartTime,
          aiWorkStartTime: roundStartTime,
        },
      });
      await prisma.seasonRound.upsert({
        where: { seasonId_round: { seasonId: season.id, round: nextRound } },
        update: {
          status: 'RUNNING',
          aiWorkStartAt: roundStartTime,
          startedAt: roundStartTime,
        },
        create: {
          seasonId: season.id,
          round: nextRound,
          status: 'RUNNING',
          aiWorkStartAt: roundStartTime,
          startedAt: roundStartTime,
        },
      });
      const task = await taskQueueService.create({
        taskType: 'ROUND_CYCLE',
        payload: { seasonId: season.id, round: nextRound },
        priority: 10,
      });
      taskResult = { type: 'ROUND_CYCLE', message: `已创建 ROUND_CYCLE 任务(${task.id})` };
    } else if (nextPhase === 'HUMAN_READING') {
      const roundRecord = await prisma.seasonRound.findUnique({
        where: { seasonId_round: { seasonId: season.id, round: currentRound } },
      });
      if (roundRecord && !roundRecord.endedAt) {
        return NextResponse.json({
          code: 400,
          data: null,
          message: '当前轮次未完成收尾，无法进入下一轮',
        });
      }
      await seasonAutoAdvanceService.advanceToNextRound(season.id, currentRound);
      taskResult = { type: 'PHASE_SWITCH', message: '已切换到 HUMAN_READING' };
    }

    // 7. 获取参与书籍
    const books = await prisma.book.findMany({
      where: { seasonId: season.id },
      include: {
        author: { select: { nickname: true } },
        _count: { select: { chapters: true } },
      },
    });

    console.log(`[NextPhase] 推进到: 第 ${nextRound} 轮 - ${getPhaseDisplayName(nextPhase)}`);

    return NextResponse.json({
      code: 0,
      data: {
        seasonId: season.id,
        seasonNumber: season.seasonNumber,
        currentRound: nextRound,
        currentPhase: nextPhase,
        phaseDisplayName: getPhaseDisplayName(nextPhase),
        phaseDescription: getPhaseDescription(nextPhase, season.roundDuration),
        action: 'PHASE_ADVANCED',
        bookCount: books.length,
        task: taskResult,
        books: books.map(b => ({
          id: b.id,
          title: b.title,
          author: b.author.nickname,
          currentChapter: b._count.chapters,
        })),
      },
      message: `已推进到第 ${nextRound} 轮 - ${getPhaseDisplayName(nextPhase)}${taskResult ? '，' + taskResult.message : ''}`,
    });
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

    const currentPhase = (season.roundPhase as RoundPhase) || 'NONE';

    return NextResponse.json({
      code: 0,
      data: {
        seasonId: season.id,
        seasonNumber: season.seasonNumber,
        themeKeyword: season.themeKeyword,
        currentRound: season.currentRound ?? 1,  // 轮次从 1 开始
        currentPhase,
        phaseDisplayName: getPhaseDisplayName(currentPhase),
        phaseDescription: getPhaseDescription(currentPhase, season.roundDuration),
        startTime: season.startTime,
        endTime: season.endTime,
        signupDeadline: season.signupDeadline,
        maxChapters: season.maxChapters,
        phaseDurations: { roundDuration: season.roundDuration ?? 20 },
      },
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
