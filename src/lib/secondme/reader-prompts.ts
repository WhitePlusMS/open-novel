/**
 * 读者 Prompt 构建函数
 */

import { formatGenreList } from './prompt-utils';

/**
 * 构建 Reader Agent System Prompt
 */
export function buildReaderSystemPrompt(params: {
  readerName: string;
  readerPersonality?: string;
  preferences: {
    genres: string[];
    style?: string;
    minRating: number;
  };
}): string {
  const personalitySection = params.readerPersonality
    ? `## 你的性格特点
${params.readerPersonality}

`
    : "";

  return `你是${params.readerName}，一位热爱阅读的读者。
${personalitySection}## 你的阅读偏好
- 喜欢的题材：${formatGenreList(params.preferences.genres)}
- 评价风格：${params.preferences.style || "客观中肯"}
- 最低评分阈值：${params.preferences.minRating}/10

## 任务
你正在阅读一本网络小说，请根据阅读内容给出评价。

## 评价维度（满分10分）
- 剧情节奏 (1-10)
- 角色塑造 (1-10)
- 文笔风格 (1-10)
- 创新程度 (1-10)

## 输出格式
{
  "overall_rating": 综合评分,
  "praise": "赞扬的点（正面反馈）",
  "critique": "批评的点（改进建议）"
}

请诚实评价，如果觉得好看就推荐，如果不好看就提出建议。`;
}

/**
 * 构建阅读反馈 Action Control
 */
export function buildReaderActionControl(commentFocus?: string[]): string {
  const focusMap: Record<string, string> = {
    "剧情": `
## 重点评价维度
- 剧情推进节奏（是否拖沓、是否有张力）
- 悬念设计（是否吸引人继续阅读）
- 情节反转（是否有意外惊喜）
- 伏笔铺设（是否为后续剧情做铺垫）`,
    "人物": `
## 重点评价维度
- 角色塑造（人物是否立体鲜活）
- 人物成长（角色是否有弧光）
- 人物互动（角色之间的化学反应）
- 人物动机（行为是否合理）`,
    "文笔": `
## 重点评价维度
- 语言表达（是否流畅优美）
- 描写手法（场景是否有画面感）
- 氛围营造（是否有沉浸感）
- 叙事风格（是否有特色）`,
    "设定": `
## 重点评价维度
- 世界观构建（设定是否完整自洽）
- 力量体系（等级设定是否合理）
- 逻辑自洽（是否存在明显bug）
- 创新程度（设定是否有新意）`,
  };

  let focusSection = '';
  if (commentFocus && commentFocus.length > 0 && !commentFocus.includes('综合')) {
    const focusDescriptions = commentFocus
      .filter((f) => focusMap[f])
      .map((f) => focusMap[f])
      .join('\n');
    focusSection = focusDescriptions ? `\n${focusDescriptions}` : '';
  }

  if (!focusSection) {
    focusSection = `
## 重点评价维度
- 剧情节奏（推进是否紧凑）
- 角色塑造（人物是否立体）
- 文笔风格（表达是否流畅）
- 创新程度（是否有新意）`;
  }

  return `
你是一个严格的网文评论家。请阅读以下章节内容，然后给出你的评价。

## 评价要求
1. 整体评分 (1-10)
2. 赞扬的点：具体说明哪里写得好
3. 批评的点：具体说明哪里需要改进
${focusSection}

## 输出 JSON 格式
{
  "overall_rating": 分数,
  "praise": "正面评价",
  "critique": "改进建议"
}`;
}

/**
 * 构建参赛确认消息 Prompt
 */
export function buildParticipationConfirmPrompt(params: {
  bookTitle: string;
  description: string;
  zoneStyle: string;
}): string {
  return `参赛 《${params.bookTitle}》
简介：${params.description}
分区：${params.zoneStyle}

请确认以上信息是否正确。回复"确认"以完成参赛报名。`;
}

/**
 * 构建赛季邀请消息 Prompt
 */
export function buildSeasonInvitePrompt(params: {
  seasonNumber: number;
  theme: string;
  duration: number;
  startTime: string;
}): string {
  return `[庆祝] 第 ${params.seasonNumber} 赛季即将开始！

**主题**: ${params.theme}
**时长**: ${params.duration} 分钟
**开始时间**: ${params.startTime}

回复"参赛 《书名》 简介 分区"即可报名参赛！

分区选项：现实悬疑/都市情感/科幻未来/历史军事/古风穿越/游戏体育/架空幻想`;
}

/**
 * 构建成就通知消息
 */
export function buildAchievementContent(params: {
  achievement: string;
  description: string;
  reward?: string;
}): string {
  return `[成就] 成就解锁：${params.achievement}

${params.description}
${params.reward ? `\n奖励：${params.reward}` : ""}`;
}
