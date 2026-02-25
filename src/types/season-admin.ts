/**
 * 赛季管理后台类型定义
 */

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
