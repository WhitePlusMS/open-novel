/**
 * 赛季推进工具函数
 */

import { RoundPhase } from '@/types/season';
import { Season } from '@prisma/client';
import { getPhaseRemainingTime as getPhaseRemainingTimeBeijing, getUtcTimeMs } from '@/lib/timezone';

// 阶段顺序
export const PHASE_ORDER: RoundPhase[] = ['AI_WORKING', 'HUMAN_READING'];

/**
 * 获取阶段时长（毫秒）
 */
export function getPhaseDurationMs(season: Season, phase: RoundPhase): number {
  const roundDurationMs = (season.roundDuration || 20) * 60 * 1000;
  const minReadingMinutes = Math.max(0, Number(process.env.MIN_READING_MINUTES ?? 5));
  const minReadingTimeMs = minReadingMinutes * 60 * 1000;

  if (phase === 'AI_WORKING') {
    return Math.max(roundDurationMs - minReadingTimeMs, 5 * 60 * 1000);
  }

  if (phase === 'HUMAN_READING') {
    const aiWorkStartTime = season.aiWorkStartTime;
    if (aiWorkStartTime && season.roundStartTime) {
      const aiWorkMs = new Date(season.roundStartTime).getTime() - new Date(aiWorkStartTime).getTime();
      const readingMs = roundDurationMs - aiWorkMs;
      return Math.max(readingMs, minReadingTimeMs);
    }
    return roundDurationMs - minReadingTimeMs;
  }

  return roundDurationMs;
}

/**
 * 获取阶段剩余时间（分钟）
 */
export function getPhaseRemainingTime(season: Season, currentPhase: RoundPhase): number {
  if (!season.roundStartTime) return 0;
  const phaseDurationMs = getPhaseDurationMs(season, currentPhase);
  const phaseStartTime = new Date(season.roundStartTime);
  return getPhaseRemainingTimeBeijing(phaseStartTime, phaseDurationMs / 60 / 1000);
}

/**
 * 获取下一阶段
 */
export function getNextPhase(currentPhase: RoundPhase): RoundPhase {
  const currentIndex = PHASE_ORDER.indexOf(currentPhase);
  if (currentIndex === -1) return 'AI_WORKING';
  if (currentIndex >= PHASE_ORDER.length - 1) return 'AI_WORKING';
  return PHASE_ORDER[currentIndex + 1];
}

/**
 * 获取阶段显示名称
 */
export function getPhaseDisplayName(phase: RoundPhase): string {
  const names: Record<RoundPhase, string> = {
    NONE: '等待开始',
    AI_WORKING: 'AI工作中',
    HUMAN_READING: '人类阅读期',
  };
  return names[phase] || phase;
}

/**
 * 检查赛季是否需要结束
 */
export function isSeasonEnded(season: Season): boolean {
  if (!season.endTime) return false;
  return new Date(season.endTime) <= new Date();
}

/**
 * 计算赛季状态信息
 */
export function getSeasonStatusInfo(season: Season): {
  currentPhase: RoundPhase;
  currentRound: number;
  phaseStartTime: Date;
  maxRounds: number;
  remainingMs: number;
} {
  const currentPhase = (season.roundPhase as RoundPhase) || 'NONE';
  const currentRound = season.currentRound || 1;
  const phaseStartTime = season.roundStartTime || season.startTime || new Date();
  const maxRounds = season.maxChapters || 7;
  const remainingMs = getPhaseRemainingTime(season, currentPhase) * 60 * 1000;

  return { currentPhase, currentRound, phaseStartTime, maxRounds, remainingMs };
}

/**
 * 阶段转换计算
 */
export function calculateTransitions(
  season: Season,
  startPhase: RoundPhase,
  startRound: number,
  startTime: Date
): Array<{ round: number; phase: RoundPhase; startTime: Date }> {
  const transitions: Array<{ round: number; phase: RoundPhase; startTime: Date }> = [];
  const maxRounds = season.maxChapters || 7;
  const maxTransitions = maxRounds * PHASE_ORDER.length + 2;
  const nowUtcMs = nowMs();

  let loopPhase = startPhase;
  let loopRound = startRound;
  let loopPhaseStartTime = startTime;
  let safety = 0;

  while (safety < maxTransitions) {
    const durationMs = getPhaseDurationMs(season, loopPhase);
    const phaseStartTimeMs = getUtcTimeMs(loopPhaseStartTime);
    const phaseEndTimeMs = phaseStartTimeMs + durationMs;
    const timeLeft = phaseEndTimeMs - nowUtcMs;

    if (timeLeft > 5000) break;

    let nextRound = loopRound;
    if (loopPhase === 'HUMAN_READING') {
      nextRound = loopRound + 1;
    }

    if (loopPhase === 'AI_WORKING' && nextRound > maxRounds) {
      return transitions;
    }

    if (nextRound > maxRounds) {
      return transitions;
    }

    const nextPhase = getNextPhase(loopPhase);
    loopPhaseStartTime = new Date(phaseEndTimeMs);
    loopPhase = nextPhase;
    loopRound = nextRound;
    transitions.push({ round: loopRound, phase: loopPhase, startTime: loopPhaseStartTime });
    safety += 1;
  }

  return transitions;
}

function nowMs(): number {
  return Date.now();
}
