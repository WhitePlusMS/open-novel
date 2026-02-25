/**
 * Agent 配置常量
 */

import { ZONE_CONFIGS } from '@/lib/utils/zone';

// 作者性格预设选项
export const AUTHOR_PERSONALITIES = [
  { value: '幽默风趣，善于刻画普通人的生活细节，情节轻松有趣', label: '幽默风趣' },
  { value: '文笔细腻，擅长描写情感纠葛，剧情温馨感人', label: '温柔细腻' },
  { value: '构思巧妙，情节跌宕起伏，擅长制造悬念', label: '悬疑推理' },
  { value: '大气磅礴，叙事宏大，擅长史诗级世界观', label: '史诗大气' },
  { value: '现实主义，贴近生活，揭露社会现实', label: '现实写实' },
  { value: '脑洞大开，想象力丰富，创意十足', label: '创意无限' },
];

// 读者性格预设选项
export const READER_PERSONALITIES = [
  { value: '毒舌但有理，评价犀利直接，一针见血', label: '毒舌犀利' },
  { value: '温柔敦厚，鼓励为主，点评温和有耐心', label: '温柔鼓励' },
  { value: '客观中肯，理性分析，优缺点都讲', label: '客观理性' },
  { value: '严厉(strict)严格，标准高，追求完美', label: '严厉严格' },
  { value: '幽默风趣，评论活泼有趣，调侃为主', label: '幽默风趣' },
  { value: '专业资深，老书虫，点评深入透彻', label: '专业资深' },
];

// 评价侧重点选项
export const COMMENT_FOCUS_OPTIONS = [
  { value: '剧情', label: '剧情', description: '关注情节推进、节奏、悬念' },
  { value: '人物', label: '人物', description: '关注角色塑造、成长、互动' },
  { value: '文笔', label: '文笔', description: '关注语言表达、描写、氛围' },
  { value: '设定', label: '设定', description: '关注世界观、力量体系、逻辑' },
  { value: '综合', label: '综合', description: '全面评价' },
];

// 写作风格选项
export const WRITING_STYLES = [
  { value: '严肃', label: '严肃', description: '庄重、正式的叙事风格' },
  { value: '幽默', label: '幽默', description: '轻松、诙谐的叙事风格' },
  { value: '浪漫', label: '浪漫', description: '情感丰富的叙事风格' },
  { value: '悬疑', label: '悬疑', description: '紧张刺激的叙事风格' },
  { value: '其他', label: '多变', description: '不拘一格，灵活多变' },
];

// 题材列表
export const GENRES = ZONE_CONFIGS.map(z => z.label);

// 创作长度选项
export const WRITING_LENGTH_OPTIONS = [
  { value: 'short', label: '短篇（精简干练）' },
  { value: 'medium', label: '中篇（平衡适当）' },
  { value: 'long', label: '长篇（宏大叙事）' },
] as const;

// 字数选项
export const WORD_COUNTS = [
  { value: 1000, label: '1,000 字' },
  { value: 2000, label: '2,000 字' },
  { value: 3000, label: '3,000 字' },
];
