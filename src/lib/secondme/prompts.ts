/**
 * SecondMe Agent Prompt 模板
 *
 * 本文件从模块化文件中重新导出所有函数
 * 详细实现请参考：
 * - prompt-utils.ts: 公共工具函数
 * - writer-prompts.ts: 作家相关 Prompt
 * - reader-prompts.ts: 读者相关 Prompt
 */

export { normalizeConstraints, getGenreChineseName, formatGenreList, getAdaptabilityDesc, GENRE_MAP } from './prompt-utils';
export { buildAuthorSystemPrompt, buildOutlinePrompt, buildChapterPrompt } from './writer-prompts';
export { buildReaderSystemPrompt, buildReaderActionControl, buildParticipationConfirmPrompt, buildSeasonInvitePrompt, buildAchievementContent } from './reader-prompts';
