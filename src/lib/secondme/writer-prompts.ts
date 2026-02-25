/**
 * 作家 Prompt 构建函数
 */

import { normalizeConstraints, getAdaptabilityDesc, formatGenreList, getGenreChineseName } from './prompt-utils';

/**
 * 根据性格和写作风格生成风格引导
 */
function getStyleGuidance(writerPersonality: string, writingStyle: string, preferredGenres: string[]): string {
  const personalityText = writerPersonality || "";
  const styleKeywords = (writingStyle || "").toLowerCase();
  const genreList = preferredGenres || [];

  let guidance = "";

  if (personalityText.trim()) {
    const cleanPersonality = personalityText.replace(/：/g, "：").replace(/:/g, "：");
    guidance += `- ${cleanPersonality}`;
  } else {
    guidance += "- 根据你的性格自由发挥";
  }

  guidance += "\n";

  // 写作风格引导
  if (styleKeywords === "严肃") {
    guidance += "- 写作风格严肃庄重，叙事严谨认真，措辞正式\n";
  } else if (styleKeywords === "幽默") {
    guidance += "- 写作风格轻松幽默，诙谐有趣，可以适当调侃\n";
  } else if (styleKeywords === "浪漫") {
    guidance += "- 写作风格浪漫抒情，情感细腻，充满理想色彩\n";
  } else if (styleKeywords === "悬疑") {
    guidance += "- 写作风格紧张刺激，节奏紧凑，悬念迭起\n";
  }

  // 题材偏好引导
  const genreGuides: Record<string, string> = {
    scifi: "你偏好科幻题材，可以加入科技元素、未来设定、人工智能等",
    fantasy: "你偏好玄幻题材，可以加入魔法、异世界、修炼体系等",
    urban: "你偏好都市题材，故事背景可以设在现代城市",
    history: "你偏好历史题材，可以借鉴历史背景或典故",
    game: "你偏好游戏题材，可以加入游戏元素、系统设定等",
    mystery: "你偏好悬疑题材，故事应该充满谜团和反转",
    romance: "你偏好言情题材，故事应该以感情线为主",
  };

  genreList.forEach(genre => {
    const guide = genreGuides[genre] || genreGuides[genre.replace('科幻', 'scifi')];
    if (guide) guidance += `- ${guide}\n`;
  });

  return guidance || "- 根据你的性格自由发挥";
}

/**
 * 构建作家角色 System Prompt
 */
export function buildAuthorSystemPrompt(params: {
  userName: string;
  writerPersonality: string;
  selfIntro?: string;
  writingStyle: string;
  adaptability: number;
  preferredGenres: string[];
  seasonTheme: string;
  constraints: string[];
  zoneStyle: string;
  wordCountTarget: number;
}): string {
  const normalizedConstraints = normalizeConstraints(params.constraints);
  const personalityDesc = params.writerPersonality || "性格多变";
  const adaptabilityDesc = getAdaptabilityDesc(params.adaptability);
  const genreDesc = formatGenreList(params.preferredGenres);

  return `你是${params.userName}，${params.selfIntro || "一位热爱创作的故事作家"}。

## 个人特质
- 性格特点：${personalityDesc}
- 听劝指数：${params.adaptability}（${adaptabilityDesc}）

## 写作偏好
- 写作风格：${params.writingStyle || "多变"}
- 偏好题材：${genreDesc}
- 每章目标字数：${params.wordCountTarget || 2000} 字

## 当前创作任务
你正在参加 InkSurvivor 赛季创作比赛：

**赛季主题**: ${params.seasonTheme}
**硬性限制**:
${normalizedConstraints.map((c) => `- ${c}`).join("\n") || "无"}
**分区风格**: ${params.zoneStyle}

## 任务要求
请严格按照以上个人特质和限制进行创作，保持个人风格一致性。`;
}

/**
 * 构建大纲生成 Prompt
 */
export function buildOutlinePrompt(params: {
  writerPersonality: string;
  writingStyle: string;
  adaptability: number;
  preferredGenres: string[];
  wordCountTarget: number;
  seasonTheme: string;
  constraints: string[];
  zoneStyle: string;
  minChapters?: number;
  maxChapters?: number;
  chapterPreference?: string;
  forcedChapter?: number;
  forcedEvent?: string;
  originalIntent?: string;
}): string {
  const writingStyle = params.writingStyle || '多变';
  const wordCount = params.wordCountTarget || 2000;
  const normalizedConstraints = normalizeConstraints(params.constraints);

  const chapterLimitText = params.minChapters && params.maxChapters
    ? `赛季章节限制：${params.minChapters}-${params.maxChapters} 章`
    : "";

  const preferenceText = params.chapterPreference
    ? `你的创作偏好：${params.chapterPreference}，每章约 ${wordCount} 字。`
    : `每章约 ${wordCount} 字。`;

  const adaptabilityNote = `听劝指数：${params.adaptability}`;

  const storyInspirationText = params.originalIntent
    ? `## 故事创意\n${params.originalIntent}\n`
    : "";

  return `请为这个故事生成一个大纲。
${storyInspirationText}
## 作者风格
- 性格：${params.writerPersonality || '性格多变'}
- 写作风格：${writingStyle}
- ${adaptabilityNote}

## 创作偏好
${preferenceText}

## 章节要求
${chapterLimitText}
根据你的创作偏好和赛季限制，在 ${params.minChapters || 3}-${params.maxChapters || 7} 章范围内自行决定合适的章节数量。
**重要：最后一章必须是完整结局章，必须完结所有伏笔和主线情节，不能是"未完待续"。**

## 硬性约束（必须遵守）
${normalizedConstraints.map((c) => `- ${c}`).join("\n") || "无"}

## 分区风格
${params.zoneStyle}

## 输出要求
严格按照以下 JSON 格式输出：

\`\`\`json
{
  "title": "故事标题（不能包含冒号）",
  "summary": "一句话简介（50字以内，不能包含冒号）",
  "characters": [
    {
      "name": "角色姓名",
      "role": "protagonist/antagonist/supporting",
      "description": "角色描述（不能包含冒号）",
      "motivation": "核心动机"
    }
  ],
  "chapters": [
    {
      "number": 1,
      "title": "章节标题（不能包含冒号）",
      "summary": "章节概要（不能包含冒号）",
      "key_events": ["事件1", "事件2"],
      "word_count_target": ${wordCount}
    }
  ],
  "themes": ["主题1", "主题2"],
  "tone": "叙事风格描述"
}
\`\`\`

请确保：
1. 章节数量在 ${params.minChapters || 3}-${params.maxChapters || 7} 章之间
2. 最后一章必须是完整的结局
3. 每个字符串字段都不能包含冒号（:）
4. 不要在字符串中嵌套引号或冒号
5. 故事有清晰的起承转合
6. 根据你的性格特点和写作风格，形成独特的叙事风格
${params.forcedChapter ? `7. 第${params.forcedChapter}章必须包含：${params.forcedEvent}` : ""}
8. 结局类型由你根据故事发展自由决定

只输出 JSON 代码块，不要有任何其他内容。`;
}

/**
 * 构建章节创作 Prompt
 */
export function buildChapterPrompt(params: {
  writerPersonality: string;
  selfIntro?: string;
  writingStyle: string;
  wordCountTarget: number;
  bookTitle: string;
  chapterNumber: number;
  totalChapters: number;
  outline: {
    summary: string;
    key_events: string[];
    word_count_target: number;
  };
  fullOutline: {
    number: number;
    title: string;
    summary: string;
    key_events: string[];
    word_count_target: number;
  }[];
  previousSummary: string;
  previousChapterContent?: string;
  feedbacks?: string[];
}): string {
  const targetWordCount = params.wordCountTarget || params.outline.word_count_target || 2000;

  const feedbackSection = params.feedbacks && params.feedbacks.length > 0
    ? "## 读者反馈（已采纳）\n" + params.feedbacks.join("\n") + "\n\n"
    : "";

  const fullOutlineText = params.fullOutline
    .map((chapter) =>
      `### 第 ${chapter.number} 章：${chapter.title}\n- 概要：${chapter.summary}\n- 关键事件：${chapter.key_events.slice(0, 3).join("、")}`
    )
    .join("\n\n");

  const isFirstChapter = params.chapterNumber === 1;
  const isLastChapter = params.chapterNumber === params.totalChapters;

  const positionHint = isFirstChapter
    ? "本章是故事的开篇，需要建立背景、引入角色"
    : isLastChapter
      ? "本章是故事的结局，需要收束所有伏笔、给出结局"
      : `本章是故事的中间章节（第 ${params.chapterNumber}/${params.totalChapters} 章），需要承上启下`;

  const previousChapterTitle = isFirstChapter ? "故事背景（本章是开篇）" : "上一章剧情（保持连贯性）";
  const previousChapterContent = isFirstChapter
    ? params.bookTitle + "的故事简介：" + (params.previousSummary || "无")
    : params.previousChapterContent || params.previousSummary;

  return `请撰写《${params.bookTitle}》第 ${params.chapterNumber} 章（共 ${params.totalChapters} 章）。

## 整本书大纲（了解故事全局）
以下是大纲，帮助你理解本章在整体故事中的位置：

${fullOutlineText}

---
**你是正在撰写：第 ${params.chapterNumber} 章（共 ${params.totalChapters} 章）**
- ${positionHint}
- ${isFirstChapter ? "建立背景、引入角色" : `本章在上文第 ${params.chapterNumber - 1} 章之后`}
${!isLastChapter ? `- 本章需要为后续章节做铺垫` : "- 本章需要收束所有伏笔，给出完整结局"}

## 本章大纲
${params.outline.summary}

## ${previousChapterTitle}
${previousChapterContent}

${feedbackSection}## 要求
- 字数：约 ${targetWordCount} 字
- 推进剧情发展
- 对话自然，符合角色性格
- 注意与前后章节的呼应，保持故事整体一致性

## 输出格式
严格按照以下格式输出：

# 章节标题(示例：第一章 此章节标题)

章节正文内容...

注意：正文中的对话可以直接使用双引号，不需要转义。只输出纯文本内容。`;
}
