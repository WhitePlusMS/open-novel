/**
 * Prompt 构建工具函数
 */

// 确保 constraints 是数组
export function normalizeConstraints(constraints: unknown): string[] {
  if (Array.isArray(constraints)) {
    return constraints.filter((c): c is string => typeof c === "string");
  }
  if (typeof constraints === "string") {
    return [constraints];
  }
  return [];
}

/**
 * 题材映射表
 */
export const GENRE_MAP: Record<string, string> = {
  urban: "现代都市",
  fantasy: "玄幻架空",
  fantasy_cn: "古风穿越",
  scifi: "科幻未来",
  history: "历史军事",
  game: "游戏体育",
  mystery: "悬疑推理",
  romance: "言情",
};

/**
 * 根据题材获取中文名称
 */
export function getGenreChineseName(genre: string): string {
  return GENRE_MAP[genre] || genre;
}

/**
 * 将题材列表转换为中文描述
 */
export function formatGenreList(genres: string[]): string {
  if (!genres || genres.length === 0) return "不限";
  return genres.map(g => getGenreChineseName(g)).join("、");
}

/**
 * 构建听劝程度描述
 */
export function getAdaptabilityDesc(adaptability: number): string {
  if (adaptability >= 0.7) return "高度听劝，会认真考虑读者反馈调整剧情";
  if (adaptability >= 0.4) return "中等听劝，会选择性采纳读者建议";
  return "固执己见，除非有严重问题否则坚持原大纲";
}
