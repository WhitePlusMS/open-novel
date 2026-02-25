/**
 * 赛季管理后台类型定义
 */

import { RoundPhase } from '@/types/season';

/**
 * 赛季信息接口（用于 API 调用）
 */
export interface SeasonInfo {
  seasonNumber: number;
  themeKeyword: string;
  constraints: readonly string[] | string[];
  zoneStyles: readonly string[] | string[];
  rewards: Record<string, unknown>;
  minChapters: number;
  maxChapters: number;
}

/**
 * Agent 参赛决策结果
 */
export interface AgentDecisionResult {
  decision: 'join' | 'skip';
  bookTitle?: string;
  shortDescription?: string;
  zoneStyle?: string;
  reason: string;
}

/**
 * 书籍创建结果
 */
export interface BookCreationResult {
  userId: string;
  userName: string;
  bookTitle?: string;
  success: boolean;
  skipped?: boolean;
  reason?: string;
}

/**
 * 赛季开始请求 DTO
 */
export interface StartSeasonDTO {
  seasonNumber?: number;
  themeKeyword?: string;
  constraints?: string[];
  zoneStyles?: string[];
  maxChapters?: number;
  minChapters?: number;
  roundDuration?: number;
  rewards?: {
    first: number;
    second: number;
    third: number;
  };
}

/**
 * 赛季开始响应
 */
export interface StartSeasonResponse {
  seasonId: string;
  seasonNumber: number;
  themeKeyword: string;
  totalAgents: number;
  joinCount: number;
  skipCount: number;
  participantCount: number;
  results: Array<{
    user: string;
    action: string;
    bookTitle?: string;
    success: boolean;
    reason?: string;
  }>;
}

/**
 * 阶段推进请求 DTO
 */
export interface PhaseAdvanceDTO {
  action?: 'NEXT_PHASE' | 'SKIP_TO_WRITING' | 'END_SEASON';
}

/**
 * 阶段推进响应
 */
export interface PhaseAdvanceResponse {
  seasonId: string;
  seasonNumber: number;
  currentRound: number;
  currentPhase: RoundPhase;
  phaseDisplayName: string;
  phaseDescription: string;
  action: string;
  bookCount: number;
  task?: {
    type: string;
    message: string;
  };
  books: Array<{
    id: string;
    title: string;
    author: string;
    currentChapter: number;
  }>;
}

/**
 * 追赶模式请求 DTO
 */
export interface CatchUpDTO {
  targetRound?: number;
}

/**
 * 追赶状态响应
 */
export interface CatchUpStatusResponse {
  hasOutline: boolean;
  outlineChapters: number[];
  existingChapters: number[];
  missingChapters: number[];
  targetRound: number;
  maxOutlineChapter: number;
  needsCatchUp: boolean;
}

/**
 * 赛季状态响应
 */
export interface SeasonStatusResponse {
  seasonId: string | null;
  seasonNumber: number | null;
  themeKeyword: string | null;
  currentRound: number;
  currentPhase: RoundPhase;
  phaseDisplayName: string;
  phaseDescription: string;
  startTime: Date | null;
  endTime: Date | null;
  signupDeadline: Date | null;
  maxChapters: number | null;
  phaseDurations: {
    roundDuration: number;
  };
}

// 赛季队列项接口
export interface SeasonQueueItem {
  id: string;
  seasonNumber: number;
  themeKeyword: string;
  constraints: string[];
  zoneStyles: string[];
  maxChapters: number;
  minChapters: number;
  roundDuration: number;
  rewards: Record<string, number>;
  plannedStartTime: string | null;
  intervalHours: number;
  status: string;
  publishedAt: string | null;
  llmSuggestion: string | null;
  llmOptimized: boolean;
}

// 赛季配置表单数据
export interface SeasonConfigForm {
  seasonNumber: number;
  themeKeyword: string;
  constraints: string;
  zoneStyles: string[];
  maxChapters: number;
  minChapters: number;
  roundDuration: number;
  rewardFirst: number;
  rewardSecond: number;
  rewardThird: number;
  plannedStartTime: string;
  intervalHours: number;
}

// 赛季详情接口（用于历史赛季列表）
export interface SeasonDetail {
  id: string;
  seasonNumber: number;
  themeKeyword: string;
  status: string;
  constraints: string[];
  zoneStyles: string[];
  maxChapters: number;
  minChapters: number;
  roundDuration: number;
  rewards: Record<string, number>;
  startTime: Date | string | null;
  endTime: Date | string | null;
  participantCount: number;
  currentRound: number;
  roundPhase: string;
  roundStartTime: Date | string | null;
}

// 排行榜书籍数据
export interface LeaderboardBook {
  bookId: string;
  rank: number;
  title: string;
  author: string;
  zoneStyle: string;
  chapterCount: number;
  coverImage?: string;
  shortDesc?: string;
  viewCount?: number;
  commentCount?: number;
  heat: number;
  status?: 'ACTIVE' | 'COMPLETED' | 'DRAFT';
}

// 排行榜数据
export interface LeaderboardData {
  books: LeaderboardBook[];
  loading: boolean;
}

// 阶段状态
export interface PhaseStatus {
  currentRound: number;
  currentPhase: string;
  phaseDisplayName: string;
}

// 赛季基本信息
export interface Season {
  id: string;
  seasonNumber: number;
  themeKeyword: string;
  status: string;
}

// Tab 类型
export type SeasonAdminTab = 'queue' | 'immediate' | 'history' | 'delete';

// 操作类型
export type SeasonActionType = 'start' | 'nextPhase' | 'endSeason' | null;

// 调试操作类型
export type DebugActionType = 'processTasks' | 'autoAdvance' | 'readerAgents' | null;
