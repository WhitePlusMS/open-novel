/**
 * 赛季管理后台工具函数
 */

import { ZONE_CONFIGS } from '@/lib/utils/zone';

// 所有可用分区
export const ALL_ZONES = ZONE_CONFIGS.map(z => ({ value: z.value, label: z.label }));

// 分区标签映射
export const ZONE_LABELS: Record<string, string> = {
  urban: '都市',
  fantasy: '玄幻',
  scifi: '科幻',
  history: '历史',
  game: '游戏',
};

// 阶段显示名称
export function getPhaseDisplayName(phase: string): string {
  const names: Record<string, string> = {
    NONE: '未开始',
    AI_WORKING: 'AI创作期',
    HUMAN_READING: '人类阅读期',
  };
  return names[phase] || phase;
}

// 状态样式
const STATUS_STYLES: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  FINISHED: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  DRAFT: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  SCHEDULED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  PUBLISHED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  SKIPPED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

// 状态标签
const STATUS_LABELS: Record<string, string> = {
  ACTIVE: '进行中',
  FINISHED: '已结束',
  DRAFT: '草稿',
  SCHEDULED: '待发布',
  PUBLISHED: '已发布',
  SKIPPED: '已跳过',
};

/**
 * 获取状态徽章
 */
export function getStatusBadge(status: string) {
  return (
    <span className={`px-2 py-0.5 text-xs rounded-full ${STATUS_STYLES[status] || 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}>
      {STATUS_LABELS[status] || status}
    </span>
  );
}

/**
 * 格式化分区显示
 */
export function formatZoneStyles(zoneStyles: string[]): string {
  if (!Array.isArray(zoneStyles) || zoneStyles.length === 0) return '无';
  return zoneStyles.map(z => ZONE_LABELS[z] || z).join('、');
}

/**
 * 格式化约束显示
 */
export function formatConstraints(constraints: string[]): string {
  if (!Array.isArray(constraints) || constraints.length === 0) return '无';
  return constraints.slice(0, 2).join('；') + (constraints.length > 2 ? ` 等${constraints.length}条` : '');
}

/**
 * 解析 LLM 建议
 */
export function parseLLMSuggestion(suggestion: string | null): string {
  if (!suggestion) return '';
  try {
    const parsed = JSON.parse(suggestion) as Record<string, unknown>;
    const explanation = parsed.creativeExplanation;
    return typeof explanation === 'string' ? explanation : suggestion;
  } catch {
    return suggestion;
  }
}

/**
 * 获取默认表单配置
 */
export function getDefaultConfigForm(seasonNumber: number) {
  return {
    seasonNumber,
    themeKeyword: '',
    constraints: '不能出现真实地名\n主角必须有成长弧线',
    zoneStyles: ['urban', 'fantasy', 'scifi', 'history', 'game'] as string[],
    maxChapters: 7,
    minChapters: 3,
    roundDuration: 20,
    rewardFirst: 1000,
    rewardSecond: 500,
    rewardThird: 200,
    plannedStartTime: '',
    intervalHours: 2,
  };
}
