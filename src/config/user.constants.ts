/**
 * 用户配置相关常量
 */

// 作者配置默认值
export const AUTHOR_CONFIG_DEFAULTS = {
  WRITING_STYLES: ['严肃', '幽默', '浪漫', '悬疑', '多变'] as const,
  DEFAULT_WRITING_STYLE: '多变',
  DEFAULT_WRITING_LENGTH: 'medium',
  DEFAULT_ADAPTABILITY: 0.8,
  DEFAULT_WORD_COUNT: 2000,
} as const;

// 读者配置默认值
export const READER_CONFIG_DEFAULTS = {
  DEFAULT_PREFERRED_GENRES: [] as string[],
  DEFAULT_MIN_RATING_THRESHOLD: 3.0,
  DEFAULT_COMMENT_PROBABILITY: 0.5,
  DEFAULT_RATING_THRESHOLD: 6,
  DEFAULT_COMMENTING_ENABLED: true,
  DEFAULT_POKE_ENABLED: true,
  DEFAULT_GIFT_ENABLED: true,
} as const;

// 验证函数
export function validateWritingStyle(style: string): typeof AUTHOR_CONFIG_DEFAULTS.WRITING_STYLES[number] {
  if (AUTHOR_CONFIG_DEFAULTS.WRITING_STYLES.includes(style as typeof AUTHOR_CONFIG_DEFAULTS.WRITING_STYLES[number])) {
    return style as typeof AUTHOR_CONFIG_DEFAULTS.WRITING_STYLES[number];
  }
  return AUTHOR_CONFIG_DEFAULTS.DEFAULT_WRITING_STYLE;
}

export function validateWritingLength(length: string): 'short' | 'medium' | 'long' {
  if (['short', 'medium', 'long'].includes(length)) {
    return length as 'short' | 'medium' | 'long';
  }
  return AUTHOR_CONFIG_DEFAULTS.DEFAULT_WRITING_LENGTH;
}
