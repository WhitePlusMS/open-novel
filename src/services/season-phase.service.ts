/**
 * 赛季阶段推进服务
 *
 * 处理赛季阶段推进的逻辑
 */

import { prisma } from '@/lib/prisma';
import { RoundPhase } from '@/types/season';
import { taskQueueService } from './task-queue.service';
import { seasonAutoAdvanceService } from './season-auto-advance.service';
import { getNextPhase as getNextPhaseUtil, getPhaseDisplayName, getPhaseDescription } from '@/lib/utils/season-utils';
import { SEASON_DEFAULTS } from '@/config/season.constants';

/**
 * 阶段推进结果
 */
export interface PhaseAdvanceResult {
  seasonId: string;
  seasonNumber: number;
  currentRound: number;
  currentPhase: RoundPhase;
  action: string;
  bookCount: number;
  task?: { type: string; message: string };
  message?: string;
  books: Array<{
    id: string;
    title: string;
    author: string;
    currentChapter: number;
  }>;
}

/**
 * 结束赛季
 */
export async function endSeason(seasonId: string, seasonNumber: number) {
  await prisma.season.update({
    where: { id: seasonId },
    data: {
      status: 'FINISHED',
      roundPhase: 'NONE',
      endTime: new Date(),
    },
  });

  return {
    seasonId,
    seasonNumber,
    action: 'SEASON_ENDED',
    message: '赛季已结束',
  };
}

/**
 * 检查轮次任务是否完成
 */
async function checkRoundTaskCompleted(seasonId: string, round: number): Promise<boolean> {
  const runningTask = await prisma.taskQueue.findFirst({
    where: {
      taskType: 'ROUND_CYCLE',
      status: { in: ['PENDING', 'PROCESSING'] },
      seasonId,
      round,
    },
  });

  if (runningTask) return false;

  const roundRecord = await prisma.seasonRound.findUnique({
    where: { seasonId_round: { seasonId, round } },
  });

  return roundRecord ? !!roundRecord.endedAt : true;
}

/**
 * 检查轮次是否完成收尾
 */
async function checkRoundCompleted(seasonId: string, round: number): Promise<boolean> {
  const roundRecord = await prisma.seasonRound.findUnique({
    where: { seasonId_round: { seasonId, round } },
  });

  return roundRecord ? !!roundRecord.endedAt : true;
}

/**
 * 推进到下一阶段
 */
export async function advanceToNextPhase(
  seasonId: string,
  currentRound: number,
  currentPhase: RoundPhase,
  action: string
): Promise<PhaseAdvanceResult | { seasonId: string; seasonNumber: number; action: string; message: string }> {
  const season = await prisma.season.findUnique({
    where: { id: seasonId },
  });

  if (!season) {
    throw new Error('赛季不存在');
  }

  const maxChapters = season.maxChapters ?? SEASON_DEFAULTS.DEFAULT_MAX_CHAPTERS;

  // 结束赛季
  if (action === 'END_SEASON') {
    return endSeason(seasonId, season.seasonNumber);
  }

  // 计算下一阶段和轮次
  let nextPhase: RoundPhase;
  let nextRound = currentRound;

  if (currentPhase === 'NONE') {
    nextPhase = 'AI_WORKING';
  } else if (currentPhase === 'HUMAN_READING') {
    nextPhase = 'AI_WORKING';
    nextRound = currentRound + 1;
  } else {
    nextPhase = getNextPhaseUtil(currentPhase);
  }

  // 检查是否超过最大轮次
  if (nextRound > maxChapters) {
    await endSeason(seasonId, season.seasonNumber);
    return {
      seasonId,
      seasonNumber: season.seasonNumber,
      action: 'MAX_ROUND_REACHED',
      message: `第 ${maxChapters} 轮结束，赛季已自动结束`,
    };
  }

  let taskResult: { type: string; message: string } | null = null;

  // AI_WORKING -> HUMAN_READING
  if (currentPhase === 'AI_WORKING' && nextPhase === 'HUMAN_READING') {
    const isCompleted = await checkRoundTaskCompleted(seasonId, currentRound);
    if (!isCompleted) {
      throw new Error('当前轮次任务仍在执行，无法手动切换阶段');
    }
    await seasonAutoAdvanceService.advanceToNextRound(seasonId, currentRound);
    taskResult = { type: 'PHASE_SWITCH', message: '已切换到 HUMAN_READING' };
  }
  // 进入 AI_WORKING
  else if (nextPhase === 'AI_WORKING') {
    if (currentPhase === 'HUMAN_READING') {
      const isCompleted = await checkRoundCompleted(seasonId, currentRound);
      if (!isCompleted) {
        throw new Error('当前轮次未完成收尾，无法进入下一轮');
      }
    }
    const roundStartTime = new Date();
    await prisma.season.update({
      where: { id: seasonId },
      data: {
        currentRound: nextRound,
        roundPhase: 'AI_WORKING',
        roundStartTime: roundStartTime,
        aiWorkStartTime: roundStartTime,
      },
    });
    await prisma.seasonRound.upsert({
      where: { seasonId_round: { seasonId, round: nextRound } },
      update: {
        status: 'RUNNING',
        aiWorkStartAt: roundStartTime,
        startedAt: roundStartTime,
      },
      create: {
        seasonId,
        round: nextRound,
        status: 'RUNNING',
        aiWorkStartAt: roundStartTime,
        startedAt: roundStartTime,
      },
    });
    const task = await taskQueueService.create({
      taskType: 'ROUND_CYCLE',
      payload: { seasonId, round: nextRound },
      priority: 10,
    });
    taskResult = { type: 'ROUND_CYCLE', message: `已创建 ROUND_CYCLE 任务(${task.id})` };
  }
  // HUMAN_READING
  else if (nextPhase === 'HUMAN_READING') {
    const isCompleted = await checkRoundCompleted(seasonId, currentRound);
    if (!isCompleted) {
      throw new Error('当前轮次未完成收尾，无法进入下一轮');
    }
    await seasonAutoAdvanceService.advanceToNextRound(seasonId, currentRound);
    taskResult = { type: 'PHASE_SWITCH', message: '已切换到 HUMAN_READING' };
  }

  // 获取参与书籍
  const books = await prisma.book.findMany({
    where: { seasonId },
    include: {
      author: { select: { nickname: true } },
      _count: { select: { chapters: true } },
    },
  });

  return {
    seasonId,
    seasonNumber: season.seasonNumber,
    currentRound: nextRound,
    currentPhase: nextPhase,
    action: 'PHASE_ADVANCED',
    bookCount: books.length,
    task: taskResult ?? undefined,
    books: books.map(b => ({
      id: b.id,
      title: b.title,
      author: b.author.nickname,
      currentChapter: b._count.chapters,
    })),
  };
}

/**
 * 获取赛季状态
 */
export async function getSeasonPhaseStatus(seasonId: string) {
  const season = await prisma.season.findUnique({
    where: { id: seasonId },
  });

  if (!season) {
    return null;
  }

  const currentPhase = (season.roundPhase as RoundPhase) || 'NONE';

  return {
    seasonId: season.id,
    seasonNumber: season.seasonNumber,
    themeKeyword: season.themeKeyword,
    currentRound: season.currentRound ?? 1,
    currentPhase,
    phaseDisplayName: getPhaseDisplayName(currentPhase),
    phaseDescription: getPhaseDescription(currentPhase, season.roundDuration ?? undefined),
    startTime: season.startTime,
    endTime: season.endTime,
    signupDeadline: season.signupDeadline,
    maxChapters: season.maxChapters,
    phaseDurations: { roundDuration: season.roundDuration ?? SEASON_DEFAULTS.DEFAULT_ROUND_DURATION },
  };
}
