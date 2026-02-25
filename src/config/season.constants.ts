/**
 * 赛季相关常量配置
 */

// 赛季默认配置
export const SEASON_DEFAULTS = {
  // 默认主题
  DEFAULT_THEME: '赛博朋克',

  // 默认约束
  DEFAULT_CONSTRAINTS: ['不能出现真实地名', '主角必须有成长弧线'],

  // 默认分区
  DEFAULT_ZONE_STYLES: ['urban', 'fantasy', 'scifi'] as const,

  // 默认章节数
  DEFAULT_MAX_CHAPTERS: 7,
  DEFAULT_MIN_CHAPTERS: 3,

  // 默认轮时长（分钟）
  DEFAULT_ROUND_DURATION: 20,

  // 默认奖励
  DEFAULT_REWARDS: {
    first: 1000,
    second: 500,
    third: 200,
  },

  // 报名截止时间（分钟）
  SIGNUP_DEADLINE_MINUTES: 10,

  // 最少阅读时间（分钟）
  MIN_READING_MINUTES: 5,
} as const;

// 赛季阶段配置
export const PHASE_CONFIG = {
  // 阶段顺序
  PHASE_ORDER: ['AI_WORKING', 'HUMAN_READING'] as const,

  // AI 工作阶段占比
  AI_WORKING_RATIO: 0.4,

  // 人类阅读阶段占比
  HUMAN_READING_RATIO: 0.6,

  // 最少 AI 工作时间（毫秒）
  MIN_AI_WORK_TIME_MS: 5 * 60 * 1000,
} as const;

// Agent 决策重试配置
export const DECISION_RETRY_CONFIG = {
  MAX_RETRIES: 3,
  BASE_DELAY_MS: 1000,
  MAX_DELAY_MS: 10000,
  BACKOFF_MULTIPLIER: 2,
} as const;

// 章节创作配置
export const CHAPTER_WRITING_CONFIG = {
  // 默认目标字数
  DEFAULT_WORD_COUNT: 2000,

  // 最小目标字数
  MIN_WORD_COUNT: 500,

  // 最大目标字数
  MAX_WORD_COUNT: 10000,

  // 听劝指数阈值
  ADAPTABILITY_THRESHOLD: 0.35,

  // 默认听劝指数
  DEFAULT_ADAPTABILITY: 0.5,

  // 默认听劝指数（作者）
  DEFAULT_AUTHOR_ADAPTABILITY: 0.8,
} as const;

// API 响应配置
export const API_CONFIG = {
  // 默认分页大小
  DEFAULT_PAGE_SIZE: 20,

  // 最大分页大小
  MAX_PAGE_SIZE: 100,

  // 异步任务延迟（毫秒）
  ASYNC_TASK_DELAY_MS: 100,
} as const;

// 检查间隔配置
export const CHECK_INTERVALS = {
  // 自动推进检查间隔（毫秒）
  SEASON_AUTO_ADVANCE: 60 * 1000, // 60 秒
} as const;

// 赛季状态
export const SEASON_STATUS = {
  PENDING: 'PENDING',
  ACTIVE: 'ACTIVE',
  FINISHED: 'FINISHED',
  CANCELLED: 'CANCELLED',
} as const;

// 轮次阶段
export const ROUND_PHASE = {
  NONE: 'NONE',
  AI_WORKING: 'AI_WORKING',
  HUMAN_READING: 'HUMAN_READING',
} as const;

// 计算辅助函数
export function getRetryDelay(attempt: number): number {
  const delay = DECISION_RETRY_CONFIG.BASE_DELAY_MS *
    Math.pow(DECISION_RETRY_CONFIG.BACKOFF_MULTIPLIER, attempt);
  return Math.min(delay, DECISION_RETRY_CONFIG.MAX_DELAY_MS);
}

export function calculateAiWorkingMinutes(roundDuration: number): number {
  return Math.round(roundDuration * PHASE_CONFIG.AI_WORKING_RATIO);
}

export function calculateHumanReadingMinutes(roundDuration: number): number {
  return Math.round(roundDuration * PHASE_CONFIG.HUMAN_READING_RATIO);
}

export function calculateSeasonEndTime(
  roundDuration: number,
  maxChapters: number
): Date {
  const totalMinutes = roundDuration * maxChapters + SEASON_DEFAULTS.SIGNUP_DEADLINE_MINUTES;
  return new Date(Date.now() + totalMinutes * 60 * 1000);
}
