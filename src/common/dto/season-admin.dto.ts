/**
 * 赛季管理 API DTO 验证
 */

import { z } from 'zod';

/**
 * 赛季开始 DTO
 */
export const StartSeasonSchema = z.object({
  seasonNumber: z.number().optional(),
  themeKeyword: z.string().default('赛博朋克'),
  constraints: z.array(z.string()).default(['不能出现真实地名', '主角必须有成长弧线']),
  zoneStyles: z.array(z.string()).default(['urban', 'fantasy', 'scifi']),
  maxChapters: z.number().min(1).max(20).default(7),
  minChapters: z.number().min(1).max(10).default(3),
  roundDuration: z.number().min(5).max(120).default(20),
  rewards: z.object({
    first: z.number().min(0).default(1000),
    second: z.number().min(0).default(500),
    third: z.number().min(0).default(200),
  }).default({ first: 1000, second: 500, third: 200 }),
});

export type StartSeasonInput = z.infer<typeof StartSeasonSchema>;

/**
 * 阶段推进 DTO
 */
export const PhaseAdvanceSchema = z.object({
  action: z.enum(['NEXT_PHASE', 'SKIP_TO_WRITING', 'END_SEASON']).default('NEXT_PHASE'),
});

export type PhaseAdvanceInput = z.infer<typeof PhaseAdvanceSchema>;

/**
 * 追赶模式 DTO
 */
export const CatchUpSchema = z.object({
  targetRound: z.number().min(1).optional(),
});

export type CatchUpInput = z.infer<typeof CatchUpSchema>;

/**
 * 赛季 ID 参数
 */
export const SeasonIdParamSchema = z.object({
  id: z.string().min(1),
});

export type SeasonIdParam = z.infer<typeof SeasonIdParamSchema>;

/**
 * 书籍 ID 参数
 */
export const BookIdParamSchema = z.object({
  id: z.string().min(1),
});

export type BookIdParam = z.infer<typeof BookIdParamSchema>;

/**
 * 章节号参数
 */
export const ChapterNumParamSchema = z.object({
  num: z.coerce.number().min(1),
});

export type ChapterNumParam = z.infer<typeof ChapterNumParamSchema>;

/**
 * 章节生成 DTO
 */
export const GenerateChapterSchema = z.object({
  chapterNumber: z.number().min(1).optional(),
  forcedOutline: z.boolean().optional(),
  testMode: z.boolean().optional(),
});

export type GenerateChapterInput = z.infer<typeof GenerateChapterSchema>;

/**
 * 大纲生成 DTO
 */
export const GenerateOutlineSchema = z.object({
  seasonTheme: z.string().optional(),
  forcedChapter: z.number().optional(),
  forcedEvent: z.string().optional(),
  originalIntent: z.string().optional(),
});

export type GenerateOutlineInput = z.infer<typeof GenerateOutlineSchema>;

/**
 * 通用分页 DTO
 */
export const PaginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20),
});

export type PaginationInput = z.infer<typeof PaginationSchema>;

/**
 * 验证请求体
 */
export function validateRequest<T>(schema: z.ZodSchema<T>, data: unknown): T {
  return schema.parse(data);
}

/**
 * 安全验证请求体（带错误处理）
 */
export function safeValidateRequest<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: z.ZodError } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}
