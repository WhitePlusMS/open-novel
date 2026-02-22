/**
 * 赛季自动推进服务
 *
 * 功能：
 * - 定时检查当前赛季状态
 * - 根据配置的阶段时长自动推进
 * - 支持手动/自动两种模式
 *
 * 阶段顺序（简化版）：
 * AI_WORKING (任务驱动) -> HUMAN_READING (剩余时间) -> AI_WORKING (下一轮)
 *
 * 注意：AI 任务通过 TaskQueue 异步执行，不阻塞 API 响应
 * AI_WORKING 阶段由 ROUND_CYCLE 任务完成后自动切换，不依赖定时器
 */

import { prisma } from '@/lib/prisma';
import { RoundPhase } from '@/types/season';
import { Season } from '@prisma/client';
import { isExpired, getPhaseRemainingTime as getPhaseRemainingTimeBeijing, now, nowMs, getUtcTimeMs } from '@/lib/timezone';
import { taskQueueService } from './task-queue.service';

// 阶段顺序（简化版：AI_WORKING -> HUMAN_READING）
const PHASE_ORDER: RoundPhase[] = ['AI_WORKING', 'HUMAN_READING'];

// 检查间隔（毫秒）
const CHECK_INTERVAL = 60 * 1000; // 每 60 秒检查一次

function getPhaseDurationMs(season: Season, phase: RoundPhase): number {
  const roundDurationMs = (season.roundDuration || 20) * 60 * 1000;
  const minReadingMinutes = Math.max(0, Number(process.env.MIN_READING_MINUTES ?? 5));
  const minReadingTimeMs = minReadingMinutes * 60 * 1000;

  // AI_WORKING 阶段：最大时间 = roundDuration - 最少人类阅读时间
  if (phase === 'AI_WORKING') {
    return Math.max(roundDurationMs - minReadingTimeMs, 5 * 60 * 1000); // 最少 5 分钟
  }

  // HUMAN_READING 阶段：使用剩余时间 = roundDuration - AI实际耗时
  if (phase === 'HUMAN_READING') {
    const aiWorkStartTime = season.aiWorkStartTime;

    // aiWorkStartTime 记录的是 AI_WORKING 阶段的开始时间
    // roundStartTime 记录的是当前阶段的开始时间
    if (aiWorkStartTime && season.roundStartTime) {
      const aiWorkMs = new Date(season.roundStartTime).getTime() - new Date(aiWorkStartTime).getTime();
      const readingMs = roundDurationMs - aiWorkMs;
      return Math.max(readingMs, minReadingTimeMs); // 确保最少 5 分钟
    }

    // 如果没有记录 AI 工作时间，默认使用 roundDuration - 5分钟
    return roundDurationMs - minReadingTimeMs;
  }

  return roundDurationMs;
}

function getPhaseRemainingTime(season: Season, currentPhase: RoundPhase): number {
  if (!season.roundStartTime) return 0;
  const phaseDurationMs = getPhaseDurationMs(season, currentPhase);
  const phaseStartTime = new Date(season.roundStartTime);
  return getPhaseRemainingTimeBeijing(phaseStartTime, phaseDurationMs / 60 / 1000);
}

/**
 * 获取下一阶段
 */
function getNextPhase(currentPhase: RoundPhase): RoundPhase {
  const currentIndex = PHASE_ORDER.indexOf(currentPhase);
  if (currentIndex === -1) {
    return 'AI_WORKING';
  }
  if (currentIndex >= PHASE_ORDER.length - 1) {
    // HUMAN_READING 结束后回到 AI_WORKING（下一轮）
    return 'AI_WORKING';
  }
  return PHASE_ORDER[currentIndex + 1];
}

/**
 * 获取阶段显示名称
 */
function getPhaseDisplayName(phase: RoundPhase): string {
  const names: Record<RoundPhase, string> = {
    NONE: '等待开始',
    AI_WORKING: 'AI工作中',
    HUMAN_READING: '人类阅读期',
  };
  return names[phase] || phase;
}

/**
 * 赛季自动推进服务类
 */
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

    // 立即执行一次检查
    try {
      await this.checkAndAdvance();
    } catch (error) {
      console.error('[SeasonAutoAdvance] 检查失败:', error);
    }

    // 启动定时检查
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
    const checkAt = new Date().toISOString();
    console.log(`[SeasonAutoAdvance] checkAndAdvance start: at=${checkAt}`);
    // 获取当前活跃赛季
    const season = await prisma.season.findFirst({
      where: { status: 'ACTIVE' },
      orderBy: { startTime: 'desc' },
    });

    if (!season) {
      console.log('[SeasonAutoAdvance] 未找到活跃赛季，跳过');
      return;
    }
    console.log(`[SeasonAutoAdvance] 当前赛季: id=${season.id}, round=${season.currentRound}, phase=${season.roundPhase}, roundStartTime=${season.roundStartTime?.toISOString()}, aiWorkStartTime=${season.aiWorkStartTime?.toISOString()}, roundDuration=${season.roundDuration}, maxChapters=${season.maxChapters}`);

    // 检查是否需要结束赛季（使用北京时间）
    if (isExpired(season.endTime)) {
      console.log('[SeasonAutoAdvance] 赛季已结束时间（北京时区），自动结束赛季');
      await this.endSeason(season.id);
      return;
    }

    let currentPhase = (season.roundPhase as RoundPhase) || 'NONE';
    let currentRound = season.currentRound || 1;
    const phaseStartTime = season.roundStartTime || season.startTime || now();

    if (currentPhase === 'AI_WORKING') {
      const runningTask = await prisma.taskQueue.findFirst({
        where: {
          taskType: 'ROUND_CYCLE',
          status: { in: ['PENDING', 'PROCESSING'] },
          seasonId: season.id,
          round: Number(currentRound),
        },
      });
      const remainingMs = getPhaseRemainingTime(season, currentPhase);
      if (runningTask) {
        if (remainingMs <= 0) {
          await this.forceEndRoundAndEnterReading(season.id, currentRound);
        } else {
          console.log(`[SeasonAutoAdvance] AI_WORKING 中存在任务，跳过推进: taskId=${runningTask.id}, status=${runningTask.status}, seasonId=${season.id}, round=${currentRound}, remainingMs=${remainingMs}`);
        }
        return;
      }
      if (remainingMs <= 0) {
        await this.forceEndRoundAndEnterReading(season.id, currentRound);
      } else {
        console.log(`[SeasonAutoAdvance] AI_WORKING 等待任务收尾: seasonId=${season.id}, round=${currentRound}, remainingMs=${remainingMs}`);
      }
      return;
    }

    const transitions: Array<{ round: number; phase: RoundPhase; startTime: Date }> = [];

    if (currentPhase === 'NONE') {
      console.log(`[SeasonAutoAdvance] 赛季未开始，进入第一轮 AI_WORKING: seasonId=${season.id}`);
      currentPhase = 'AI_WORKING';
      currentRound = 1;
      transitions.push({ round: currentRound, phase: currentPhase, startTime: phaseStartTime });
    }

    if (currentPhase === 'HUMAN_READING') {
      const roundRecord = await prisma.seasonRound.findUnique({
        where: { seasonId_round: { seasonId: season.id, round: currentRound } },
      });
      if (roundRecord && !roundRecord.endedAt) {
        const remainingMs = getPhaseRemainingTime(season, currentPhase);
        console.log(`[SeasonAutoAdvance] HUMAN_READING 等待收尾完成: seasonId=${season.id}, round=${currentRound}, remainingMs=${remainingMs}`);
        return;
      }
    }

    const maxRounds = season.maxChapters || 7;
    const maxTransitions = maxRounds * PHASE_ORDER.length + 2;
    let safety = 0;
    const nowUtcMs = nowMs(); // UTC 毫秒数

    let loopPhaseStartTime = phaseStartTime;
    while (safety < maxTransitions) {
      const durationMs = getPhaseDurationMs(season, currentPhase);
      const phaseStartTimeMs = getUtcTimeMs(loopPhaseStartTime);
      const phaseEndTimeMs = phaseStartTimeMs + durationMs;
      const timeLeft = phaseEndTimeMs - nowUtcMs;
      console.log(`[SeasonAutoAdvance] Loop: seasonId=${season.id}, phase=${currentPhase}, round=${currentRound}, durationMs=${durationMs}, phaseStartTimeMs=${phaseStartTimeMs}, nowUtcMs=${nowUtcMs}, timeLeftMs=${timeLeft}`);

      if (timeLeft > 5000) {
        console.log(`[SeasonAutoAdvance] Time left > 5s, breaking loop: seasonId=${season.id}, phase=${currentPhase}, round=${currentRound}`);
        break;
      }

      let nextRound = currentRound;
      if (currentPhase === 'HUMAN_READING') {
        nextRound = currentRound + 1;
      }

      if (currentPhase === 'AI_WORKING' && nextRound > maxRounds) {
        console.log(`[SeasonAutoAdvance] AI_WORKING 已达最大轮次，自动结束赛季: seasonId=${season.id}, round=${currentRound}, maxRounds=${maxRounds}`);
        await this.endSeason(season.id);
        return;
      }

      if (nextRound > maxRounds) {
        console.log(`[SeasonAutoAdvance] HUMAN_READING 已达最大轮次，自动结束赛季: seasonId=${season.id}, round=${currentRound}, maxRounds=${maxRounds}`);
        await this.endSeason(season.id);
        return;
      }

      const nextPhase = getNextPhase(currentPhase);
      loopPhaseStartTime = new Date(phaseEndTimeMs);
      currentPhase = nextPhase;
      currentRound = nextRound;
      transitions.push({ round: currentRound, phase: currentPhase, startTime: loopPhaseStartTime });
      safety += 1;
    }

    if (transitions.length === 0) {
      const remainingMs = getPhaseRemainingTime(season, currentPhase);
      if (remainingMs > 5000) {
        console.log(`[SeasonAutoAdvance] 当前阶段剩余时间 > 5s，暂不推进: seasonId=${season.id}, phase=${currentPhase}, round=${currentRound}, remainingMs=${remainingMs}`);
        return;
      }
    }

    if (transitions.length > 0) {
      console.log(`[SeasonAutoAdvance] 本次推进步骤: seasonId=${season.id}, count=${transitions.length}, transitions=${transitions.map(t => `${t.round}:${t.phase}`).join('|')}`);
    }
    for (const transition of transitions) {
      await this.advancePhase(season.id, transition.round, transition.phase, transition.startTime);
    }
  }

  /**
   * 推进阶段（内部调用）
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

      // 更新赛季状态
      await prisma.season.update({
        where: { id: seasonId },
        data: {
          currentRound: round,
          roundPhase: phase,
          roundStartTime: roundStartTime || new Date(),
        },
      });

      console.log(`[SeasonAutoAdvance] 已推进: seasonId=${seasonId}, round=${round}, phase=${getPhaseDisplayName(phase)}`);

      await this.ensureSeasonRoundOnPhase(seasonId, round, phase, roundStartTime);

      // 触发相应的任务
      await this.triggerPhaseTask(seasonId, round, phase);

    } catch (error) {
      const code = (error as { code?: string }).code;
      console.error(`[SeasonAutoAdvance] 推进失败: seasonId=${seasonId}, round=${round}, phase=${phase}, code=${code || 'unknown'}`, error);
    }
  }

  /**
   * 触发阶段任务
   *
   * 简化版：只有 AI_WORKING 和 HUMAN_READING 两个阶段
   * - AI_WORKING: 创建 ROUND_CYCLE 任务并立即执行，完成后自动调用 advanceToNextRound
   * - HUMAN_READING: 不需要触发任务，等待人类阅读
   */
  private async triggerPhaseTask(seasonId: string, round: number, phase: RoundPhase): Promise<void> {
    console.log(`[SeasonAutoAdvance] triggerPhaseTask: seasonId=${seasonId}, round=${round}, phase=${phase}`);

    if (phase === 'AI_WORKING') {
      console.log(`[SeasonAutoAdvance] 🎯 进入 AI_WORKING 阶段，创建 ROUND_CYCLE 任务: seasonId=${seasonId}, round=${round}`);

      // 进入 AI_WORKING 阶段时，记录开始时间
      const now = new Date();
      console.log(`[SeasonAutoAdvance] 📝 记录 aiWorkStartTime: seasonId=${seasonId}, at=${now.toISOString()}`);
      await prisma.season.update({
        where: { id: seasonId },
        data: {
          aiWorkStartTime: now,
        },
      });

      // 创建任务到队列，由 Worker 异步执行，不阻塞 API 响应
      const task = await taskQueueService.create({
        taskType: 'ROUND_CYCLE',
        payload: { seasonId, round },
        priority: 10,
      });
      console.log(`[SeasonAutoAdvance] ✅ ROUND_CYCLE 任务已创建: id=${task.id}, seasonId=${seasonId}, round=${round}`);
    } else if (phase === 'HUMAN_READING') {
      console.log(`[SeasonAutoAdvance] 📖 进入 HUMAN_READING 阶段: seasonId=${seasonId}, round=${round}`);
    } else {
      console.log(`[SeasonAutoAdvance] ⚠️ 未知阶段: seasonId=${seasonId}, round=${round}, phase=${phase}`);
    }
  }

  /**
   * 推进到下一阶段（AI_WORKING -> HUMAN_READING）
   * 由 ROUND_CYCLE 任务完成后调用
   */
  public async advanceToNextRound(seasonId: string, round: number): Promise<void> {
    console.log(`[SeasonAutoAdvance] advanceToNextRound called: seasonId=${seasonId}, round=${round}`);

    const season = await prisma.season.findUnique({ where: { id: seasonId } });
    console.log(`[SeasonAutoAdvance] 当前赛季状态: seasonId=${seasonId}, phase=${season?.roundPhase}, currentRound=${season?.currentRound}`);

    if (!season || season.roundPhase !== 'AI_WORKING') {
      console.log(`[SeasonAutoAdvance] 跳过：当前阶段不是 AI_WORKING: seasonId=${seasonId}, phase=${season?.roundPhase}`);
      return;
    }

    // 计算阅读时长 = roundDuration - AI工作时长
    const roundDurationMs = (season.roundDuration || 20) * 60 * 1000;
    const aiWorkMs = season.aiWorkStartTime
      ? new Date().getTime() - new Date(season.aiWorkStartTime).getTime()
      : 0;
    const readingDurationMs = Math.max(roundDurationMs - aiWorkMs, 0);

    console.log(`[SeasonAutoAdvance] 时间计算: seasonId=${seasonId}, roundDurationMs=${roundDurationMs}, aiWorkMs=${aiWorkMs}, readingDurationMs=${readingDurationMs}`);

    // 更新阶段为 HUMAN_READING，设置阅读开始时间
    const readingStartAt = new Date();
    await prisma.season.update({
      where: { id: seasonId },
      data: {
        roundPhase: 'HUMAN_READING',
        roundStartTime: readingStartAt,
        // 注意：currentRound 在 HUMAN_READING 阶段结束后才增加
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

    console.log(`[SeasonAutoAdvance] ✅ AI工作完成切换 HUMAN_READING: seasonId=${seasonId}, round=${round}, readingMinutes=${readingDurationMs / 60000}`);
  }

  public async finalizeRound(seasonId: string, round: number): Promise<void> {
    const nowAt = new Date();
    const existing = await prisma.seasonRound.findUnique({
      where: { seasonId_round: { seasonId, round } },
    });
    const status = existing?.timedOutAt ? 'TIMED_OUT' : 'COMPLETED';
    await prisma.seasonRound.upsert({
      where: { seasonId_round: { seasonId, round } },
      update: {
        status,
        endedAt: nowAt,
      },
      create: {
        seasonId,
        round,
        status,
        startedAt: nowAt,
        endedAt: nowAt,
      },
    });
  }

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
    console.log(`[SeasonAutoAdvance] ⏰ 到时结轮，进入 HUMAN_READING: seasonId=${seasonId}, round=${round}`);
  }

  private async ensureSeasonRoundOnPhase(
    seasonId: string,
    round: number,
    phase: RoundPhase,
    roundStartTime?: Date
  ): Promise<void> {
    if (phase === 'AI_WORKING') {
      const startAt = roundStartTime || new Date();
      await prisma.seasonRound.upsert({
        where: { seasonId_round: { seasonId, round } },
        update: {
          status: 'RUNNING',
          aiWorkStartAt: startAt,
          startedAt: startAt,
        },
        create: {
          seasonId,
          round,
          status: 'RUNNING',
          aiWorkStartAt: startAt,
          startedAt: startAt,
        },
      });
      return;
    }
    if (phase === 'HUMAN_READING') {
      const readingStartAt = roundStartTime || new Date();
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
          aiWorkEndAt: readingStartAt,
          readingStartAt,
        },
      });
    }
  }

  /**
   * 结束赛季
   */
  private async endSeason(seasonId: string): Promise<void> {
    try {
      // 1. 更新赛季状态
      await prisma.season.update({
        where: { id: seasonId },
        data: {
          status: 'FINISHED',
          roundPhase: 'NONE',
          endTime: new Date(),
        },
      });

      // 2. 将所有参赛书籍状态更新为 COMPLETED
      await prisma.book.updateMany({
        where: {
          seasonId,
          status: 'ACTIVE',
        },
        data: {
          status: 'COMPLETED',
        },
      });

      console.log(`[SeasonAutoAdvance] 赛季已结束，已将 ${await prisma.book.count({ where: { seasonId, status: 'COMPLETED' } })} 本书籍标记为完结`);
    } catch (error) {
      console.error('[SeasonAutoAdvance] 结束赛季失败:', error);
    }
  }
}

// 单例实例
export const seasonAutoAdvanceService = new SeasonAutoAdvanceService();

// 模式选择：
// - 开发模式：使用轮询（每5秒检查）
// - 生产模式（Vercel）：使用 Cron 触发，不启动轮询
const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL;
const useCron = process.env.USE_CRON === 'true' || isProduction;

if (process.env.NODE_ENV === 'test' || process.env.SEASON_AUTO_ADVANCE_ENABLED === 'false') {
  // 明确禁用
  console.log('[SeasonAutoAdvance] 自动推进已禁用');
} else if (useCron) {
  // 生产模式：使用 Cron 触发，不启动轮询
  console.log('[SeasonAutoAdvance] 生产模式：使用 Cron 触发，不启动轮询');
} else {
  // 开发模式：使用轮询
  console.log(`[SeasonAutoAdvance] ${process.env.NODE_ENV} 模式：自动启动轮询服务`);
  setTimeout(() => {
    seasonAutoAdvanceService.start().catch((err) => {
      console.error('[SeasonAutoAdvance] 启动失败:', err);
    });
  }, 3000);
}
