// 大纲模块类型定义

/**
 * 角色类型
 */
export type CharacterRole = 'protagonist' | 'antagonist' | 'supporting';

/**
 * 角色信息
 */
export interface Character {
  name: string;
  role: CharacterRole;
  description: string;
  motivation: string;
}

/**
 * 章节计划
 */
export interface ChapterPlan {
  number: number;
  title: string;
  summary: string;
  key_events: string[];
  word_count_target: number;
}

/**
 * 大纲数据
 */
export interface OutlineData {
  title: string;
  summary: string;
  characters: Character[];
  chapters: ChapterPlan[];
  themes: string[];
  tone: string;
}

/**
 * 大纲数据（别名，用于兼容旧代码）
 */
export type BookOutline = OutlineData;

/**
 * 大纲详情（从数据库获取的格式）
 */
export interface OutlineDetail {
  id: string;
  bookId: string;
  originalIntent: string;
  characters: string;           // JSON string
  chaptersPlan: string;        // JSON string
  modificationLog: string | null; // JSON string
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 修改日志项
 */
export interface ModificationLogItem {
  chapterNumber: number;
  updatedAt: Date;
  changes: Partial<ChapterPlan>;
}

/**
 * 大纲生成参数（API 传入）
 */
export interface GenerateOutlineParams {
  seasonTheme?: string;
  constraints?: string[];
  zoneStyle?: string;
  forcedChapter?: number;
  forcedEvent?: string;
  originalIntent?: string; // 故事创意/灵感
}

/**
 * 大纲读取快照（用于生成大纲）
 */
export interface OutlineReadSnapshot {
  seasonId: string;
  seasonTheme: string;
  seasonConstraints: string[];
  seasonZoneStyles: string[];
  seasonMaxChapters: number;
  seasonMinChapters: number;
  bookId: string;
  bookTitle: string;
  zoneStyle: string;
  chaptersPlan: unknown;  // JSON 解析后的数据
  chaptersCount: number;
  authorId: string;
  authorNickname: string;
  authorAgentConfig: Record<string, unknown>;
}

/**
 * 下一章大纲快照
 */
export interface NextOutlineSnapshot {
  bookId: string;
  bookTitle: string;
  currentChapterCount: number;
  nextChapterNumber: number;
  chaptersPlan: ChapterPlan[] | null;
  originalIntent: string | null;
  characters: Character[] | null;
  comments: Array<{ type: 'ai' | 'human'; content: string; rating?: number }>;
  authorAgentConfig: Record<string, unknown>;
  seasonTheme: string;
  seasonConstraints: string[];
  seasonMaxChapters: number;
  seasonMinChapters: number;
  zoneStyle: string;
}
