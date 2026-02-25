/**
 * 赛季自动推进服务
 *
 * 功能：
 * - 定时检查当前赛季状态
 * - 根据配置的阶段时长自动推进
 * - 支持手动/自动两种模式
 */

import { prisma } from '@/lib/prisma;
import { RoundPhase } from '@/types/season';
import { Season } from '@prisma/client';
import { isExpired, now } from '@/lib/timezone';
import { taskQueueService } from './task-queue.service';
import {
  getPhaseDurationMs,
  getPhaseRemainingTime,
  getNextPhase,
  getPhaseDisplayName,
  getSeasonStatusInfo,
  calculateTransitions,
  PHASE_ORDER,
} from '@/lib/season-advance-utils';

// 检查间隔（毫秒）
const CHECK_INTERVAL = 60 * 1000;

export class SeasonAutoAdvanceService {
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;

  /**
   * 启动自动推进服务
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('[SeasonAutoAdvance] 服务已在运行中');
      return;
    }

    console.log('[SeasonAutoAdvance] 启动自动推进服务...');
    this.isRunning = true;

    try {
      await this.checkAndAdvance();
    } catch (error) {
      console.error('[SeasonAutoAdvance] 检查失败:', error);
    }

    this.timer = setInterval(async () => {
      try {
        await this.checkAndAdvance();
      } catch (error) {
        console.error('[SeasonAutoAdvance] 检查失败:', error);
      }
    }, CHECK_INTERVAL);
  }

  /**
   * 停止自动推进服务
   */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
    console.log('[SeasonAutoAdvance] 服务已停止');
  }

  /**
   * 检查并推进赛季阶段
   */
  async checkAndAdvance(): Promise<void> {
    console.log(`[SeasonAutoAdvance] checkAndAdvance start: at=${new Date().toISOString()}`);

    const season = await prisma.season.findFirst({
      where: { status: 'ACTIVE' },
      orderBy: { startTime: 'desc' },
    });

    if (!season) {
      console.log('[SeasonAutoAdvance] 未找到活跃赛季，跳过');
      return;
    }

    console.log(`[SeasonAutoAdvance] 当前赛季: id=${season.id}, round=${season.currentRound}, phase=${season.roundPhase}`);

    // 检查是否需要结束赛季
    if (isExpired(season.endTime)) {
      console.log('[SeasonAutoAdvance] 赛季已结束时间，自动结束赛季');
      await this.endSeason(season.id);
      return;
    }

    const { currentPhase, currentRound, phaseStartTime, maxRounds, remainingMs } = getSeasonStatusInfo(season);

    // AI_WORKING 阶段处理
    if (currentPhase === 'AI_WORKING') {
      const runningTask = await prisma.taskQueue.findFirst({
        where: {
          taskType: 'ROUND_CYCLE',
          status: { in: ['PENDING', 'PROCESSING'] },
          seasonId: season.id,
          round: Number(currentRound),
        },
      });

      if (runningTask) {
        if (remainingMs <= 0) {
          await this.forceEndRoundAndEnterReading(season.id, currentRound);
        } else {
          console.log(`[SeasonAutoAdvance] AI_WORKING 中存在任务，跳过推进`);
        }
        return;
      }

      if (remainingMs <= 0) {
        await this.forceEndRoundAndEnterReading(season.id, currentRound);
      }
      return;
    }

    // NONE 阶段处理
    if (currentPhase === 'NONE') {
      console.log(`[SeasonAutoAdvance] 赛季未开始，进入第一轮 AI_WORKING`);
      await this.advancePhase(season.id, 1, 'AI_WORKING', phaseStartTime);
      return;
    }

    // HUMAN_READING 阶段处理
    if (currentPhase === 'HUMAN_READING') {
      const roundRecord = await prisma.seasonRound.findUnique({
        where: { seasonId_round: { seasonId: season.id, round: currentRound } },
      });
      if (roundRecord && !roundRecord.endedAt) {
        console.log(`[SeasonAutoAdvance] HUMAN_READING 等待收尾完成`);
        return;
      }
    }

    // 计算需要进行的转换
    const transitions = calculateTransitions(season, currentPhase, currentRound, phaseStartTime);

    if (transitions.length === 0) {
      if (remainingMs > 5000) {
        console.log(`[SeasonAutoAdvance] 当前阶段剩余时间 > 5s，暂不推进`);
        return;
      }
    }

    // 检查是否需要结束赛季
    if (currentPhase === 'AI_WORKING' && currentRound >= maxRounds) {
      console.log(`[SeasonAutoAdvance] AI_WORKING 已达最大轮次，自动结束赛季`);
      await this.endSeason(season.id);
      return;
    }

    if (transitions.length > 0) {
      console.log(`[SeasonAutoAdvance] 本次推进步骤: ${transitions.length} 个`);
    }

    for (const transition of transitions) {
      await this.advancePhase(season.id, transition.round, transition.phase, transition.startTime);
    }
  }

  /**
   * 推进阶段
   */
  private async advancePhase(
    seasonId: string,
    round: number,
    phase: RoundPhase,
    roundStartTime?: Date
  ): Promise<void> {
    try {
      const season = await prisma.season.findUnique({ where: { id: seasonId } });
      if (!season) return;

      await prisma.season.update({
        where: { id: seasonId },
        data: {
          currentRound: round,
          roundPhase: phase,
          roundStartTime: roundStartTime || new Date(),
        },
      });

      console.log(`[SeasonAutoAdvance] 已推进: round=${round}, phase=${getPhaseDisplayName(phase)}`);

      await this.ensureSeasonRoundOnPhase(seasonId, round, phase, roundStartTime);
      await this.triggerPhaseTask(seasonId, round, phase);

    } catch (error) {
      console.error(`[SeasonAutoAdvance] 推进失败:`, error);
    }
  }

  /**
   * 触发阶段任务
   */
  private async triggerPhaseTask(seasonId: string, round: number, phase: RoundPhase): Promise<void> {
    console.log(`[SeasonAutoAdvance] triggerPhaseTask: round=${round}, phase=${phase}`);

    if (phase === 'AI_WORKING') {
      console.log(`[SeasonAutoAdvance] 🎯 进入 AI_WORKING 阶段，创建 ROUND_CYCLE 任务`);

      const now = new Date();
      await prisma.season.update({
        where: { id: seasonId },
        data: { aiWorkStartTime: now },
      });

      const task = await taskQueueService.create({
        taskType: 'ROUND_CYCLE',
        payload: { seasonId, round },
        priority: 10,
      });
      console.log(`[SeasonAutoAdvance] ✅ ROUND_CYCLE 任务已创建: id=${task.id}`);
    } else if (phase === 'HUMAN_READING') {
      console.log(`[SeasonAutoAdvance] 📖 进入 HUMAN_READING 阶段`);
    }
  }

  /**
   * 推进到下一阶段
   */
  public async advanceToNextRound(seasonId: string, round: number): Promise<void> {
    console.log(`[SeasonAutoAdvance] advanceToNextRound called: round=${round}`);

    const season = await prisma.season.findUnique({ where: { id: seasonId } });
    if (!season || season.roundPhase !== 'AI_WORKING') {
      console.log(`[SeasonAutoAdvance] 跳过：当前阶段不是 AI_WORKING`);
      return;
    }

    const roundDurationMs = (season.roundDuration || 20) * 60 * 1000;
    const aiWorkMs = season.aiWorkStartTime
      ? new Date().getTime() - new Date(season.aiWorkStartTime).getTime()
      : 0;
    const readingDurationMs = Math.max(roundDurationMs - aiWorkMs, 0);

    const readingStartAt = new Date();
    await prisma.season.update({
      where: { id: seasonId },
      data: {
        roundPhase: 'HUMAN_READING',
        roundStartTime: readingStartAt,
      },
    });

    await prisma.seasonRound.upsert({
      where: { seasonId_round: { seasonId, round } },
      update: {
        aiWorkEndAt: readingStartAt,
        readingStartAt,
      },
      create: {
        seasonId,
        round,
        status: 'RUNNING',
        aiWorkStartAt: season.aiWorkStartTime ?? readingStartAt,
        aiWorkEndAt: readingStartAt,
        readingStartAt,
      },
    });

    console.log(`[SeasonAutoAdvance] ✅ AI工作完成切换 HUMAN_READING`);
  }

  /**
   * 完成轮次
   */
  public async finalizeRound(seasonId: string, round: number): Promise<void> {
    const nowAt = new Date();
    const existing = await prisma.seasonRound.findUnique({
      where: { seasonId_round: { seasonId, round } },
    });
    const status = existing?.timedOutAt ? 'TIMED_OUT' : 'COMPLETED';
    await prisma.seasonRound.upsert({
      where: { seasonId_round: { seasonId, round } },
      update: { status, endedAt: nowAt },
      create: { seasonId, round, status, startedAt: nowAt, endedAt: nowAt },
    });
  }

  /**
   * 强制结束轮次进入阅读阶段
   */
  private async forceEndRoundAndEnterReading(seasonId: string, round: number): Promise<void> {
    const nowAt = new Date();
    await prisma.seasonRound.upsert({
      where: { seasonId_round: { seasonId, round } },
      update: {
        status: 'TIMED_OUT',
        timedOutAt: nowAt,
        aiWorkEndAt: nowAt,
        readingStartAt: nowAt,
      },
      create: {
        seasonId,
        round,
        status: 'TIMED_OUT',
        timedOutAt: nowAt,
        aiWorkEndAt: nowAt,
        readingStartAt: nowAt,
      },
    });
    await prisma.season.update({
      where: { id: seasonId },
      data: {
        roundPhase: 'HUMAN_READING',
        roundStartTime: nowAt,
      },
    });
    console.log(`[SeasonAutoAdvance] ⏰ 到时结轮，进入 HUMAN_READING`);
  }

  /**
   * 确保赛季轮次记录存在
   */
  private async ensureSeasonRoundOnPhase(
    seasonId: string,
    round: number,
    phase: RoundPhase,
    roundStartTime?: Date
  ): Promise<void> {
    const startAt = roundStartTime || new Date();

    if (phase === 'AI_WORKING') {
      await prisma.seasonRound.upsert({
        where: { seasonId_round: { seasonId, round } },
        update: { status: 'RUNNING', aiWorkStartAt: startAt, startedAt: startAt },
        create: { seasonId, round, status: 'RUNNING', aiWorkStartAt: startAt, startedAt: startAt },
      });
    } else if (phase === 'HUMAN_READING') {
      await prisma.seasonRound.upsert({
        where: { seasonId_round: { seasonId, round } },
        update: { aiWorkEndAt: startAt, readingStartAt: startAt },
        create: { seasonId, round, status: 'RUNNING', aiWorkEndAt: startAt, readingStartAt: startAt },
      });
    }
  }

  /**
   * 结束赛季
   */
  private async endSeason(seasonId: string): Promise<void> {
    try {
      await prisma.season.update({
        where: { id: seasonId },
        data: { status: 'FINISHED', roundPhase: 'NONE', endTime: new Date() },
      });

      await prisma.book.updateMany({
        where: { seasonId, status: 'ACTIVE' },
        data: { status: 'COMPLETED' },
      });

      console.log(`[SeasonAutoAdvance] 赛季已结束`);
    } catch (error) {
      console.error('[SeasonAutoAdvance] 结束赛季失败:', error);
    }
  }
}

// 单例实例
export const seasonAutoAdvanceService = new SeasonAutoAdvanceService();

// 模式选择
const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL;
const useCron = process.env.USE_CRON === 'true' || isProduction;

if (process.env.NODE_ENV === 'test' || process.env.SEASON_AUTO_ADVANCE_ENABLED === 'false') {
  console.log('[SeasonAutoAdvance] 自动推进已禁用');
} else if (useCron) {
  console.log('[SeasonAutoAdvance] 生产模式：使用 Cron 触发，不启动轮询');
} else {
  console.log(`[SeasonAutoAdvance] ${process.env.NODE_ENV} 模式：自动启动轮询服务`);
  setTimeout(() => {
    seasonAutoAdvanceService.start().catch((err) => {
      console.error('[SeasonAutoAdvance] 启动失败:', err);
    });
  }, 3000);
}
