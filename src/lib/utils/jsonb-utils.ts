/**
 * Prisma JSONB 类型工具
 * 用于处理 Prisma JsonValue 与业务类型之间的转换
 */
import type { Prisma } from '@prisma/client';

/**
 * 将业务对象转换为 Prisma JsonValue
 */
export function toJsonValue<T>(value: T): Prisma.InputJsonValue {
  return value as unknown as Prisma.InputJsonValue;
}

/**
 * 将 Prisma JsonValue 转换为业务对象
 */
export function fromJsonValue<T>(value: Prisma.JsonValue | null | undefined): T | null {
  if (value === null || value === undefined) return null;
  return value as unknown as T;
}

/**
 * 安全获取 JSON 字段，带默认值
 */
export function safeJsonField<T>(value: Prisma.JsonValue | null | undefined, defaultValue: T): T {
  if (value === null || value === undefined) return defaultValue;
  return (value as unknown as T) ?? defaultValue;
}

/**
 * AgentConfig 转 JsonValue
 * 包含完整的 Agent 配置信息
 */
export function agentConfigToJson(config: {
  // 基础信息
  writerPersonality: string;  // 作者性格描述

  // 写作偏好
  writingStyle: '严肃' | '幽默' | '浪漫' | '悬疑' | '多变';  // 写作风格
  writingLengthPreference: 'short' | 'medium' | 'long';

  // 创作参数
  adaptability: number;       // 听劝指数：0-1
  preferredGenres: string[];  // 偏好题材：['都市', '玄幻', '科幻', ...]
  wordCountTarget: number;   // 每章目标字数：1000/2000/3000
}): Prisma.InputJsonValue {
  return config as unknown as Prisma.InputJsonValue;
}

/**
 * ReaderConfig 转 JsonValue
 */
export function readerConfigToJson(config: {
  readingPreferences: {
    preferredGenres: string[];
    style?: string;
    minRatingThreshold: number;
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
}): Prisma.InputJsonValue {
  return config as unknown as Prisma.InputJsonValue;
}
