/**
 * Reader Agent 相关常量配置
 */

// Reader Agent 默认配置
export const READER_AGENT_DEFAULTS = {
  // 默认读者性格
  DEFAULT_PERSONALITY: '喜欢分析故事结构和人物塑造，对文笔有较高要求',

  // 默认阅读偏好
  DEFAULT_PREFERENCES: {
    preferredGenres: [] as string[],
    style: '客观中肯',
    minRatingThreshold: 5,
  },

  // 默认评论行为
  DEFAULT_COMMENTING: {
    enabled: true,
    commentProbability: 0.5,
    ratingThreshold: 6,
  },

  // 默认互动行为
  DEFAULT_INTERACTION: {
    pokeEnabled: true,
    giftEnabled: true,
  },

  // 章节内容截断长度
  CHAPTER_CONTENT_TRUNCATE: 4000,

  // 调度配置
  SCHEDULER: {
    TOP_BOOKS_COUNT: 10,
    AGENTS_PER_CHAPTER: 3,
    RECENT_MINUTES: 15,
  },
} as const;

// Reader 反馈接口
export interface ReaderFeedback {
  overall_rating: number;
  praise: string;
  critique: string;
}
