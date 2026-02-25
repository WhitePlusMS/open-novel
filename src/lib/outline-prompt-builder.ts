/**
 * 大纲生成 Prompt 构建器
 */

import type { BookOutline, ChapterOutline } from './types';

/**
 * 构建大纲修改判断的 prompt
 */
export function buildModificationDecisionPrompt(params: {
  adaptability: number;
  currentRound: number;
  existingOutline: BookOutline | null;
  recentComments: Array<{ type: 'ai' | 'human'; content: string; rating?: number }>;
}): string {
  const adaptabilityLevel = params.adaptability >= 0.7 ? '高度听劝' : params.adaptability >= 0.4 ? '中等听劝' : '固执己见';

  // 格式化评论
  const aiComments = params.recentComments.filter(c => c.type === 'ai').slice(0, 5);
  const humanComments = params.recentComments.filter(c => c.type === 'human').slice(0, 3);

  let outlineInfo = '';
  if (params.existingOutline) {
    // 输出完整的大纲详情
    const chaptersFullDetail = params.existingOutline.chapters.map(c => {
      return `### 第${c.number}章 "${c.title}"
- 概要：${c.summary}
- 关键事件：${c.key_events?.join('、') || '无'}
- 字数目标：${c.word_count_target || 2000}`;
    }).join('\n\n');

    outlineInfo = `
## 当前大纲
- 书名：${params.existingOutline.title}
- 主线：${params.existingOutline.summary}
- 章节数：${params.existingOutline.chapters.length} 章
- 关键人物：${params.existingOutline.characters.map(c => `${c.name}(${c.role}): ${c.description}`).join('；')}

## 各章节完整大纲

${chaptersFullDetail}
`;
  }

  return `## 任务
判断是否需要根据读者反馈修改故事大纲。

## 作者信息
- 听劝指数：${params.adaptability}（${adaptabilityLevel}）
- 当前轮次：第 ${params.currentRound} 轮

${outlineInfo}
## 读者反馈

### AI 读者评论（选 Top 5）
${aiComments.map((c, i) => `${i + 1}. ${c.content}${c.rating !== undefined ? `（评分: ${c.rating}/10）` : ''}`).join('\n')}

### 人类读者评论（选 Top 3）
${humanComments.length > 0 ? humanComments.map((c, i) => `${i + 1}. ${c.content}`).join('\n') : '暂无人类评论'}

## 修改规则
### 轮次限制（强制）
- **当前是第 ${params.currentRound} 轮**
- **只能修改第 ${params.currentRound} 章及之后的大纲**
- 第 ${params.currentRound - 1} 章及之前的章节已经写完，**绝对不能修改**

### 绝对不能修改
- 故事主线/主题
- 关键人物（名字、性格、核心设定）
- 章节总数

### 可以根据反馈调整
- 具体事件安排
- 章节的情节走向
- 配角命运/戏份
- 悬念设置

## 输出格式 (JSON)
{
  "shouldModify": true/false,
  "targetChapters": [2, 3],  // 需要修改的章节列表，空数组表示不修改
  "changes": "修改意见（一段话描述如何修改，如：'第二章增加女配角的戏份，第三章调整情节走向'）"
}

只输出 JSON，不要有其他内容。`;
}

/**
 * 构建大纲修改的 prompt（支持多章节）
 */
export function buildModifyOutlinePrompt(params: {
  currentRound: number;
  targetChapters: number[];
  existingOutline: BookOutline;
  changes: string;
}): string {
  // 获取所有目标章节的当前大纲
  const targetChaptersOutlines = params.targetChapters.map(chNum => ({
    number: chNum,
    outline: params.existingOutline.chapters.find(c => c.number === chNum),
    prev: params.existingOutline.chapters.find(c => c.number === chNum - 1),
    next: params.existingOutline.chapters.find(c => c.number === chNum + 1),
  }));

  // 构建每个目标章节的上下文
  const chaptersContext = targetChaptersOutlines.map(t => {
    return `### 第 ${t.number} 章（待修改）
标题：${t.outline?.title || '无'}
概要：${t.outline?.summary || '无'}
关键事件：${t.outline?.key_events?.join(', ') || '无'}

**上一章** ${t.prev ? `"${t.prev.title}": ${t.prev.summary}` : '（无）'}
**下一章** ${t.next ? `"${t.next.title}": ${t.next.summary}` : '（无）'}`;
  }).join('\n\n');

  return `## 任务
根据读者反馈，同时修改以下章节的大纲：第 ${params.targetChapters.join('、')} 章。

## 修改原因
${params.changes}

## 修改约束
- **只能修改第 ${params.targetChapters.join('、')} 章的大纲**
- 其他章节的大纲必须保持原样
- 章节总数保持 ${params.existingOutline.chapters.length} 章不变

## 目标章节上下文

${chaptersContext}

## 关键人物（不能修改）
${params.existingOutline.characters.map(c => `- ${c.name}: ${c.description}`).join('\n')}

## 修改规则
1. **绝对不能修改**：人物、章节总数、已建立的背景设定
2. **可以调整**：该章节的情节走向、具体事件、悬念设置
3. 必须保持与上下文的连贯性

## 输出格式 (JSON)
同时输出所有修改后的章节大纲：
{
  "chapters": [
    { "number": ${params.targetChapters[0]}, "title": "新标题", "summary": "新概要", "key_events": ["事件1"], "word_count_target": 2000 },
    ...
  ]
}

只输出 JSON，不要有其他内容。`;
}

/**
 * 构建单章大纲生成提示
 */
export function buildSingleChapterPrompt(params: {
  bookTitle: string;
  chapterNumber: number;
  previousChapterSummary: string;
  previousChapterContent?: string;
  existingChapterOutline?: {
    title: string;
    summary: string;
  };
  feedbacks?: string[];
  isLastChapter: boolean;
}): string {
  return `请为《${params.bookTitle}》第 ${params.chapterNumber} 章生成详细大纲。

## 前文回顾
${params.previousChapterContent || params.previousChapterSummary}

${params.existingChapterOutline ? `## 当前章节大纲（必须在此基础上优化，不能完全重写）
- 标题：${params.existingChapterOutline.title}
- 概要：${params.existingChapterOutline.summary}

**重要：只能在原大纲基础上进行微调优化，不能改变剧情走向、不能更换人物、不能改变章节主题。**` : ''}

${params.feedbacks && params.feedbacks.length > 0 ? `## 读者反馈（根据反馈调整细节，但不能偏离原大纲）
${params.feedbacks.map((f) => `- ${f}`).join('\n')}` : ''}

## 输出格式 (JSON)
{
  "number": ${params.chapterNumber},
  "title": "章节标题（简洁有力，不超过10字）",
  "summary": "章节概要（100-150字）",
  "key_events": ["关键事件1", "关键事件2"],
  "word_count_target": 2000
}

${params.isLastChapter ? '注意：这是最后一章，需要有完结感。' : '注意：结尾需要留有悬念。'}

现在开始创作，只输出 JSON，不要有其他内容。`;
}

/**
 * 标准化分区风格
 */
export function normalizeZoneStyle(zoneStyle: string): string {
  const zoneMap: Record<string, string> = {
    urban: '现代都市',
    fantasy: '玄幻架空',
    scifi: '科幻未来',
  };
  return zoneMap[zoneStyle.toLowerCase()] || zoneStyle;
}
