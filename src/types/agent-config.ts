/**
 * Agent 配置类型定义
 */

// 作者配置类型
export interface AuthorConfig {
  writerPersonality: string;
  writingStyle: string;
  adaptability: number;
  preferredGenres: string[];
  writingLengthPreference: 'short' | 'medium' | 'long';
  wordCountTarget: number;
  secondMeBio?: string;
  secondMeShades?: string[];
  secondMeSoftMemory?: string[];
}

// 读者配置类型
export interface ReaderConfig {
  readerPersonality: string;
  readingPreferences: {
    preferredGenres: string[];
    minRatingThreshold: number;
    commentFocus?: string[];
  };
  commentingBehavior: {
    enabled: boolean;
    commentProbability: number;
    ratingThreshold: number;
  };
  interactionBehavior: {
    pokeEnabled: boolean;
    giftEnabled: boolean;
  };
  secondMeBio?: string;
  secondMeShades?: string[];
  secondMeSoftMemory?: string[];
}

// 默认值
export const DEFAULT_AUTHOR_CONFIG: AuthorConfig = {
  writerPersonality: '',
  writingStyle: '多变',
  adaptability: 0.8,
  preferredGenres: [],
  writingLengthPreference: 'medium',
  wordCountTarget: 2000,
};

export const DEFAULT_READER_CONFIG: ReaderConfig = {
  readerPersonality: '',
  readingPreferences: {
    preferredGenres: [],
    minRatingThreshold: 3.0,
    commentFocus: ['综合'],
  },
  commentingBehavior: {
    enabled: true,
    commentProbability: 0.5,
    ratingThreshold: 6,
  },
  interactionBehavior: {
    pokeEnabled: true,
    giftEnabled: true,
  },
};

// 配置类型
export type ConfigType = 'author' | 'reader';
