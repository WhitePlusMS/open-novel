/**
 * 赛季公共工具函数
 *
 * 提取赛季相关的公共逻辑，避免代码重复
 */

import { prisma } from '@/lib/prisma';
import { RoundPhase } from '@/types/season';
import { SEASON_DEFAULTS, PHASE_CONFIG } from '@/config/season.constants';

/**
 * 获取当前活跃赛季
 * 找不到返回 null
 */
export async function getActiveSeason() {
  return prisma.season.findFirst({
    where: { status: 'ACTIVE' },
    orderBy: { startTime: 'desc' },
  });
}

/**
 * 获取当前活跃赛季（带错误处理）
 */
export async function getActiveSeasonOrThrow(errorMessage = '没有正在进行的赛季') {
  const season = await getActiveSeason();
  if (!season) {
    throw new Error(errorMessage);
  }
  return season;
}

/**
 * 根据赛季 ID 获取赛季
 */
export async function getSeasonById(seasonId: string) {
  return prisma.season.findUnique({
    where: { id: seasonId },
  });
}

/**
 * 获取赛季信息（用于 API 调用）
 */
export function getSeasonInfo(season: Awaited<ReturnType<typeof getActiveSeason>>) {
  if (!season) return null;

  return {
    seasonNumber: season.seasonNumber,
    themeKeyword: season.themeKeyword,
    constraints: parseJsonField(season.constraints, SEASON_DEFAULTS.DEFAULT_CONSTRAINTS),
    zoneStyles: parseJsonField(season.zoneStyles, SEASON_DEFAULTS.DEFAULT_ZONE_STYLES),
    rewards: parseJsonField(season.rewards, SEASON_DEFAULTS.DEFAULT_REWARDS),
    minChapters: season.minChapters ?? SEASON_DEFAULTS.DEFAULT_MIN_CHAPTERS,
    maxChapters: season.maxChapters ?? SEASON_DEFAULTS.DEFAULT_MAX_CHAPTERS,
  };
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
 * 获取阶段说明
 */
export function getPhaseDescription(phase: RoundPhase, roundDuration?: number): string {
  const totalMinutes = roundDuration ?? SEASON_DEFAULTS.DEFAULT_ROUND_DURATION;
  const aiWorkingMinutes = Math.round(totalMinutes * PHASE_CONFIG.AI_WORKING_RATIO);
  const humanReadingMinutes = Math.round(totalMinutes * PHASE_CONFIG.HUMAN_READING_RATIO);

  const descriptions: Record<RoundPhase, string> = {
    NONE: '赛季准备中',
    AI_WORKING: `Agent 生成大纲和章节（${aiWorkingMinutes}分钟）`,
    HUMAN_READING: `读者阅读章节（${humanReadingMinutes}分钟）`,
  };
  return descriptions[phase] || phase;
}

/**
 * 获取下一阶段
 */
export function getNextPhase(currentPhase: RoundPhase): RoundPhase {
  const validPhase = currentPhase === 'NONE' ? 'AI_WORKING' : currentPhase;
  const currentIndex = PHASE_CONFIG.PHASE_ORDER.indexOf(validPhase as 'AI_WORKING' | 'HUMAN_READING');
  if (currentIndex === -1) {
    return 'AI_WORKING';
  }
  if (currentIndex >= PHASE_CONFIG.PHASE_ORDER.length - 1) {
    return 'AI_WORKING';
  }
  return PHASE_CONFIG.PHASE_ORDER[currentIndex + 1];
}

/**
 * 安全解析 JSON 字段
 */
export function parseJsonField<T>(field: unknown, defaultValue: T): T {
  if (!field) return defaultValue;
  try {
    const parsed = JSON.parse(field as string);
    return parsed ?? defaultValue;
  } catch {
    return defaultValue;
  }
}

/**
 * 获取赛季的当前轮次
 */
export function getCurrentRound(season: { currentRound?: number | null }) {
  return season.currentRound ?? 1;
}

/**
 * 获取赛季的当前阶段
 */
export function getCurrentPhase(season: { roundPhase?: string | null }): RoundPhase {
  return (season.roundPhase as RoundPhase) || 'NONE';
}

/**
 * 检查赛季是否已结束
 */
export function isSeasonEnded(season: { endTime?: Date | string | null }) {
  if (!season.endTime) return false;
  return new Date(season.endTime) <= new Date();
}

/**
 * 获取参与赛季的书籍
 */
export async function getSeasonBooks(seasonId: string) {
  return prisma.book.findMany({
    where: { seasonId },
    include: {
      author: { select: { id: true, nickname: true } },
      _count: { select: { chapters: true } },
    },
  });
}

/**
 * 更新赛季参与人数
 */
export async function updateSeasonParticipantCount(seasonId: string) {
  const count = await prisma.book.count({
    where: { seasonId },
  });

  return prisma.season.update({
    where: { id: seasonId },
    data: { participantCount: count },
  });
}

/**
 * 创建赛季错误响应
 */
export function createSeasonNotFoundResponse() {
  return {
    code: 400,
    data: null,
    message: '没有正在进行的赛季',
  };
}

/**
 * 创建赛季响应数据
 */
export function createSeasonStatusResponse(season: Awaited<ReturnType<typeof getActiveSeason>>) {
  if (!season) {
    return {
      seasonId: null,
      seasonNumber: null,
      themeKeyword: null,
      currentRound: 1,
      currentPhase: 'NONE' as RoundPhase,
      phaseDisplayName: '等待开始',
      phaseDescription: '赛季准备中',
      startTime: null,
      endTime: null,
      signupDeadline: null,
      maxChapters: null,
      phaseDurations: { roundDuration: SEASON_DEFAULTS.DEFAULT_ROUND_DURATION },
    };
  }

  const currentPhase = getCurrentPhase(season);

  return {
    seasonId: season.id,
    seasonNumber: season.seasonNumber,
    themeKeyword: season.themeKeyword,
    currentRound: getCurrentRound(season),
    currentPhase,
    phaseDisplayName: getPhaseDisplayName(currentPhase),
    phaseDescription: getPhaseDescription(currentPhase, season.roundDuration ?? undefined),
    startTime: season.startTime,
    endTime: season.endTime,
    signupDeadline: season.signupDeadline,
    maxChapters: season.maxChapters,
    phaseDurations: {
      roundDuration: season.roundDuration ?? SEASON_DEFAULTS.DEFAULT_ROUND_DURATION,
    },
  };
}
