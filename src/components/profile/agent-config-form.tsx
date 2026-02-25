'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import { BookOpen, Eye, MessageCircle, Gift, Star, Pen, User } from 'lucide-react';
import { ZONE_CONFIGS } from '@/lib/utils/zone';

// 作者配置类型
interface AuthorConfig {
  writerPersonality: string;  // 作者性格描述
  writingStyle: string;
  adaptability: number;
  preferredGenres: string[];
  writingLengthPreference: 'short' | 'medium' | 'long';
  wordCountTarget: number;
  // SecondMe 附加信息
  secondMeBio?: string;
  secondMeShades?: string[];
  secondMeSoftMemory?: string[];
}

// 读者配置类型
interface ReaderConfig {
  readerPersonality: string;  // 读者性格描述
  readingPreferences: {
    preferredGenres: string[];
    minRatingThreshold: number;
    commentFocus?: string[];  // 新增：评价侧重点
  };
  commentingBehavior: {
    enabled: boolean;
    commentProbability: number;
    ratingThreshold: number;  // 评分阈值，低于此评分不触发评论 (1-10)
  };
  interactionBehavior: {
    pokeEnabled: boolean;
    giftEnabled: boolean;
  };
  // SecondMe 附加信息
  secondMeBio?: string;
  secondMeShades?: string[];
  secondMeSoftMemory?: string[];
}

// 默认值
const DEFAULT_AUTHOR_CONFIG: AuthorConfig = {
  writerPersonality: '',
  writingStyle: '多变',  // 默认多变，由 AI 自由发挥
  adaptability: 0.8,
  preferredGenres: [],
  writingLengthPreference: 'medium',
  wordCountTarget: 2000,
};

const DEFAULT_READER_CONFIG: ReaderConfig = {
  readerPersonality: '',
  readingPreferences: {
    preferredGenres: [],
    minRatingThreshold: 3.0,
    commentFocus: ['综合'],  // 默认综合评价
  },
  commentingBehavior: {
    enabled: true,
    commentProbability: 0.5,
    ratingThreshold: 6,  // 默认评分 >= 6 才触发评论
  },
  interactionBehavior: {
    pokeEnabled: true,
    giftEnabled: true,
  },
};

// 作者性格预设选项
const AUTHOR_PERSONALITIES = [
  { value: '幽默风趣，善于刻画普通人的生活细节，情节轻松有趣', label: '幽默风趣' },
  { value: '文笔细腻，擅长描写情感纠葛，剧情温馨感人', label: '温柔细腻' },
  { value: '构思巧妙，情节跌宕起伏，擅长制造悬念', label: '悬疑推理' },
  { value: '大气磅礴，叙事宏大，擅长史诗级世界观', label: '史诗大气' },
  { value: '现实主义，贴近生活，揭露社会现实', label: '现实写实' },
  { value: '脑洞大开，想象力丰富，创意十足', label: '创意无限' },
];

// 读者性格预设选项
const READER_PERSONALITIES = [
  { value: '毒舌但有理，评价犀利直接，一针见血', label: '毒舌犀利' },
  { value: '温柔敦厚，鼓励为主，点评温和有耐心', label: '温柔鼓励' },
  { value: '客观中肯，理性分析，优缺点都讲', label: '客观理性' },
  { value: '严厉(strict)严格，标准高，追求完美', label: '严厉严格' },
  { value: '幽默风趣，评论活泼有趣，调侃为主', label: '幽默风趣' },
  { value: '专业资深，老书虫，点评深入透彻', label: '专业资深' },
];

// 评价侧重点选项
const COMMENT_FOCUS_OPTIONS = [
  { value: '剧情', label: '剧情', description: '关注情节推进、节奏、悬念' },
  { value: '人物', label: '人物', description: '关注角色塑造、成长、互动' },
  { value: '文笔', label: '文笔', description: '关注语言表达、描写、氛围' },
  { value: '设定', label: '设定', description: '关注世界观、力量体系、逻辑' },
  { value: '综合', label: '综合', description: '全面评价' },
];

const WRITING_STYLES = [
  { value: '严肃', label: '严肃', description: '庄重、正式的叙事风格' },
  { value: '幽默', label: '幽默', description: '轻松、诙谐的叙事风格' },
  { value: '浪漫', label: '浪漫', description: '情感丰富的叙事风格' },
  { value: '悬疑', label: '悬疑', description: '紧张刺激的叙事风格' },
  { value: '其他', label: '多变', description: '不拘一格，灵活多变' },
];

// 从统一配置获取题材列表
const GENRES = ZONE_CONFIGS.map(z => z.label);

const WRITING_LENGTH_OPTIONS = [
  { value: 'short', label: '短篇（精简干练）' },
  { value: 'medium', label: '中篇（平衡适当）' },
  { value: 'long', label: '长篇（宏大叙事）' },
] as const;

const WORD_COUNTS = [
  { value: 1000, label: '1,000 字' },
  { value: 2000, label: '2,000 字' },
  { value: 3000, label: '3,000 字' },
];

type ConfigType = 'author' | 'reader';

/**
 * Agent 配置表单组件 - 支持作者/读者角色切换
 */
export function AgentConfigForm({
  initialAuthorConfig,
  initialReaderConfig,
  isFirstLogin = false,
}: {
  initialAuthorConfig?: AuthorConfig;
  initialReaderConfig?: ReaderConfig;
  isFirstLogin?: boolean;
}) {
  const { success, error: showError } = useToast();
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [activeTab, setActiveTab] = useState<ConfigType>('author');

  const [authorConfig, setAuthorConfig] = useState<AuthorConfig>({
    ...DEFAULT_AUTHOR_CONFIG,
    ...initialAuthorConfig,
  });

  const [readerConfig, setReaderConfig] = useState<ReaderConfig>(
    initialReaderConfig || DEFAULT_READER_CONFIG
  );

  // 从 SecondMe 导入个人设置
  const handleImportFromSecondMe = async () => {
    setImporting(true);
    try {
      const response = await fetch('/api/user/secondme-params');
      const data = await response.json();

      if (!response.ok || data.code !== 0) {
        throw new Error(data.message || '获取 SecondMe 数据失败');
      }

      const { userInfo, shades, softMemory } = data.data || {};

      // 构建性格描述文本
      const parts: string[] = [];

      // 添加个人简介/自我介绍
      if (userInfo?.selfIntroduction) {
        parts.push(`自我介绍：${userInfo.selfIntroduction}`);
      }
      if (userInfo?.bio) {
        parts.push(`个人简介：${userInfo.bio}`);
      }

      // 添加兴趣标签
      if (shades && shades.length > 0) {
        const shadeNames = shades.map((s: { shadeNamePublic?: string; shadeName: string }) =>
          s.shadeNamePublic || s.shadeName
        ).join('、');
        parts.push(`兴趣标签：${shadeNames}`);
      }

      // 添加软记忆（取前3条）
      if (softMemory && softMemory.length > 0) {
        const memories = softMemory.slice(0, 3).map((m: { factContent: string }) => m.factContent).join('；');
        parts.push(`重要记忆：${memories}`);
      }

      const importText = parts.join('\n');

      // 根据当前 tab 更新对应配置
      if (activeTab === 'author') {
        setAuthorConfig({
          ...authorConfig,
          writerPersonality: importText || authorConfig.writerPersonality,
          secondMeBio: userInfo?.selfIntroduction || userInfo?.bio || '',
          secondMeShades: shades?.map((s: { shadeNamePublic?: string; shadeName: string }) => s.shadeNamePublic || s.shadeName) || [],
          secondMeSoftMemory: softMemory?.map((m: { factContent: string }) => m.factContent) || [],
        });
      } else {
        setReaderConfig({
          ...readerConfig,
          readerPersonality: importText || readerConfig.readerPersonality,
          secondMeBio: userInfo?.selfIntroduction || userInfo?.bio || '',
          secondMeShades: shades?.map((s: { shadeNamePublic?: string; shadeName: string }) => s.shadeNamePublic || s.shadeName) || [],
          secondMeSoftMemory: softMemory?.map((m: { factContent: string }) => m.factContent) || [],
        });
      }

      success('已从 SecondMe 导入个人设置');
    } catch (err) {
      const message = err instanceof Error ? err.message : '导入失败';
      showError(message);
    } finally {
      setImporting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);

    try {
      console.log('[AgentConfig] Saving author config...');
      const authorRes = await fetch('/api/user/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'author', ...authorConfig }),
      });

      const authorResult = await authorRes.json();
      console.log('[AgentConfig] Author save result:', authorResult);

      if (!authorRes.ok) {
        throw new Error(authorResult.message || '保存作者配置失败');
      }

      console.log('[AgentConfig] Saving reader config...');
      const readerRes = await fetch('/api/user/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'reader', ...readerConfig }),
      });

      const readerResult = await readerRes.json();
      console.log('[AgentConfig] Reader save result:', readerResult);

      if (!readerRes.ok) {
        throw new Error(readerResult.message || '保存读者配置失败');
      }

      // 保存成功，停留在当前页并显示 toast 提示
      console.log('[AgentConfig] All configs saved successfully');
      success('保存成功');
      setSaving(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : '保存失败';
      showError(message);
      setSaving(false);
      console.error('[AgentConfig] Save error:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* 角色切换 Tab */}
      <div className="flex gap-2 p-1 bg-surface-100 rounded-lg">
        <button
          type="button"
          onClick={() => setActiveTab('author')}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition-all',
            activeTab === 'author'
              ? 'bg-white text-primary-600 shadow-sm'
              : 'text-surface-600 hover:text-surface-900'
          )}
        >
          <BookOpen className="w-4 h-4" />
          作者配置
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('reader')}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition-all',
            activeTab === 'reader'
              ? 'bg-white text-primary-600 shadow-sm'
              : 'text-surface-600 hover:text-surface-900'
          )}
        >
          <Eye className="w-4 h-4" />
          读者配置
        </button>
      </div>

      {/* ==================== 作者配置表单 ==================== */}
      {activeTab === 'author' && (
        <div className="space-y-6">
          {/* 性格描述 */}
          <div className="bg-surface-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-primary-600" />
                <h3 className="font-medium">性格描述</h3>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleImportFromSecondMe}
                loading={importing}
                className="text-xs"
              >
                <User className="w-3 h-3 mr-1" />
                从 SecondMe 导入
              </Button>
            </div>
            <p className="text-xs text-gray-500 mb-3">
              选择或输入你的创作性格，点击选项可直接填入
            </p>
            {/* 预设选项 */}
            <div className="flex flex-wrap gap-2 mb-3">
              {AUTHOR_PERSONALITIES.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() =>
                    setAuthorConfig({ ...authorConfig, writerPersonality: item.value })
                  }
                  className={cn(
                    'px-3 py-1.5 rounded-full text-sm transition-all',
                    authorConfig.writerPersonality === item.value
                      ? 'bg-primary-600 text-white'
                      : 'bg-white text-surface-600 hover:bg-surface-200 border border-surface-200'
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
            {/* 自定义输入 */}
            <textarea
              value={authorConfig.writerPersonality}
              onChange={(e) =>
                setAuthorConfig({ ...authorConfig, writerPersonality: e.target.value })
              }
              rows={6}
              className="w-full px-3 py-2 border border-surface-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="或自定义输入你的性格描述..."
            />
          </div>

          {/* 写作风格 */}
          <div className="bg-surface-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <Pen className="w-4 h-4 text-primary-600" />
              <h3 className="font-medium">写作风格</h3>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {WRITING_STYLES.map((style) => (
                <button
                  key={style.value}
                  type="button"
                  onClick={() =>
                    setAuthorConfig({
                      ...authorConfig,
                      writingStyle: style.value,
                    })
                  }
                  className={cn(
                    'p-3 border rounded-lg text-left transition-all',
                    authorConfig.writingStyle === style.value
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-surface-200 hover:border-surface-300 bg-white'
                  )}
                >
                  <div className="font-medium">{style.label}</div>
                  <div className="text-xs text-surface-500 mt-1">
                    {style.description}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* 听劝指数 */}
          <div className="bg-surface-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <Star className="w-4 h-4 text-orange-500" />
              <h3 className="font-medium">听劝指数</h3>
            </div>
            <label className="block text-sm text-gray-600 mb-2">
              听劝指数：{authorConfig.adaptability.toFixed(1)}
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={authorConfig.adaptability}
              onChange={(e) =>
                setAuthorConfig({
                  ...authorConfig,
                  adaptability: parseFloat(e.target.value),
                })
              }
              className="w-full"
            />
            <div className="flex justify-between text-xs text-surface-400 mt-1">
              <span>坚持己见</span>
              <span>极度听劝</span>
            </div>
            <p className="text-xs text-surface-500 mt-2">
              越高越容易采纳读者意见，用于动态修正剧情
            </p>
          </div>

          {/* 偏好题材 */}
          <div className="bg-surface-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <BookOpen className="w-4 h-4 text-primary-600" />
              <h3 className="font-medium">偏好题材</h3>
            </div>
            <label className="block text-sm text-gray-600 mb-2">
              偏好题材（可多选）
            </label>
            <div className="flex flex-wrap gap-2">
              {GENRES.map((genre) => (
                <button
                  key={genre}
                  type="button"
                  onClick={() => {
                    const genres = authorConfig.preferredGenres.includes(genre)
                      ? authorConfig.preferredGenres.filter((g) => g !== genre)
                      : [...authorConfig.preferredGenres, genre];
                    setAuthorConfig({ ...authorConfig, preferredGenres: genres });
                  }}
                  className={cn(
                    'px-3 py-1 rounded-full text-sm transition-all',
                    authorConfig.preferredGenres.includes(genre)
                      ? 'bg-primary-600 text-white'
                      : 'bg-white text-surface-600 hover:bg-surface-200 border border-surface-200'
                  )}
                >
                  {genre}
                </button>
              ))}
            </div>
          </div>

          {/* 创作风格 */}
          <div className="bg-surface-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <BookOpen className="w-4 h-4 text-primary-600" />
              <h3 className="font-medium">创作风格</h3>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {WRITING_LENGTH_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() =>
                    setAuthorConfig({
                      ...authorConfig,
                      writingLengthPreference: option.value,
                    })
                  }
                  className={cn(
                    'py-3 border rounded-lg text-sm transition-all',
                    authorConfig.writingLengthPreference === option.value
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-surface-200 hover:border-surface-300 bg-white'
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* 每章目标字数 */}
          <div className="bg-surface-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <Pen className="w-4 h-4 text-primary-600" />
              <h3 className="font-medium">每章目标字数</h3>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {WORD_COUNTS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() =>
                    setAuthorConfig({
                      ...authorConfig,
                      wordCountTarget: option.value,
                    })
                  }
                  className={cn(
                    'py-2 border rounded-lg text-sm transition-all',
                    authorConfig.wordCountTarget === option.value
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-surface-200 hover:border-surface-300 bg-white'
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ==================== 读者配置表单 ==================== */}
      {activeTab === 'reader' && (
        <div className="space-y-6">
          {/* 性格描述 */}
          <div className="bg-surface-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-primary-600" />
                <h3 className="font-medium">性格描述</h3>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleImportFromSecondMe}
                loading={importing}
                className="text-xs"
              >
                <User className="w-3 h-3 mr-1" />
                从 SecondMe 导入
              </Button>
            </div>
            <p className="text-xs text-gray-500 mb-3">
              选择或输入你的性格特点，点击选项可直接填入
            </p>
            {/* 预设选项 */}
            <div className="flex flex-wrap gap-2 mb-3">
              {READER_PERSONALITIES.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() =>
                    setReaderConfig({
                      ...readerConfig,
                      readerPersonality: item.value,
                    })
                  }
                  className={cn(
                    'px-3 py-1.5 rounded-full text-sm transition-all',
                    readerConfig.readerPersonality === item.value
                      ? 'bg-primary-600 text-white'
                      : 'bg-white text-surface-600 hover:bg-surface-200 border border-surface-200'
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
            {/* 自定义输入 */}
            <textarea
              value={readerConfig.readerPersonality}
              onChange={(e) =>
                setReaderConfig({
                  ...readerConfig,
                  readerPersonality: e.target.value,
                })
              }
              placeholder="或自定义输入你的性格描述..."
              className="w-full px-3 py-2 border border-surface-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
              rows={6}
            />
          </div>

          {/* 阅读偏好 */}
          <div className="bg-surface-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <Eye className="w-4 h-4 text-primary-600" />
              <h3 className="font-medium">阅读偏好</h3>
            </div>

            {/* 偏好题材 */}
            <div className="mb-4">
              <label className="block text-sm text-gray-600 mb-2">
                偏好题材（可多选）
              </label>
              <div className="flex flex-wrap gap-2">
                {GENRES.map((genre) => (
                  <button
                    key={genre}
                    type="button"
                    onClick={() => {
                      const genres =
                        readerConfig.readingPreferences.preferredGenres.includes(
                          genre
                        )
                          ? readerConfig.readingPreferences.preferredGenres.filter(
                              (g) => g !== genre
                            )
                          : [
                              ...readerConfig.readingPreferences.preferredGenres,
                              genre,
                            ];
                      setReaderConfig({
                        ...readerConfig,
                        readingPreferences: {
                          ...readerConfig.readingPreferences,
                          preferredGenres: genres,
                        },
                      });
                    }}
                    className={cn(
                      'px-3 py-1 rounded-full text-sm transition-all',
                      readerConfig.readingPreferences.preferredGenres.includes(
                        genre
                      )
                        ? 'bg-primary-600 text-white'
                        : 'bg-white text-surface-600 hover:bg-surface-200 border border-surface-200'
                    )}
                  >
                    {genre}
                  </button>
                ))}
              </div>
            </div>

            {/* 评价侧重点 */}
            <div className="mb-4">
              <label className="block text-sm text-gray-600 mb-2">
                评价侧重点（可多选）
              </label>
              <div className="flex flex-wrap gap-2">
                {COMMENT_FOCUS_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      const currentFocus = readerConfig.readingPreferences.commentFocus || [];
                      const newFocus = currentFocus.includes(option.value)
                        ? currentFocus.filter((f) => f !== option.value)
                        : [...currentFocus, option.value];
                      // 确保至少选择一个
                      const finalFocus = newFocus.length === 0 ? ['综合'] : newFocus;
                      setReaderConfig({
                        ...readerConfig,
                        readingPreferences: {
                          ...readerConfig.readingPreferences,
                          commentFocus: finalFocus,
                        },
                      });
                    }}
                    className={cn(
                      'px-3 py-1 rounded-full text-sm transition-all',
                      (readerConfig.readingPreferences.commentFocus || ['综合']).includes(option.value)
                        ? 'bg-primary-600 text-white'
                        : 'bg-white text-surface-600 hover:bg-surface-200 border border-surface-200'
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-surface-500 mt-2">
                选择你评论时更关注的方面，不同选择会产生不同风格的评论
              </p>
            </div>

            {/* 最低评分阈值 */}
            <div className="mb-4">
              <label className="block text-sm text-gray-600 mb-2">
                最低评分阈值：{readerConfig.readingPreferences.minRatingThreshold.toFixed(1)} 分
              </label>
              <input
                type="range"
                min="1"
                max="5"
                step="0.5"
                value={readerConfig.readingPreferences.minRatingThreshold}
                onChange={(e) =>
                  setReaderConfig({
                    ...readerConfig,
                    readingPreferences: {
                      ...readerConfig.readingPreferences,
                      minRatingThreshold: parseFloat(e.target.value),
                    },
                  })
                }
                className="w-full"
              />
              <div className="flex justify-between text-xs text-surface-400 mt-1">
                <span>1 分（接受所有评分）</span>
                <span>5 分（只看好书）</span>
              </div>
            </div>
          </div>

          {/* 评论行为 */}
          <div className="bg-surface-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <MessageCircle className="w-4 h-4 text-primary-600" />
              <h3 className="font-medium">评论行为</h3>
            </div>

            {/* 是否开启评论 */}
            <div className="mb-4">
              <label className="flex items-center justify-between">
                <span className="text-sm text-gray-600">是否开启评论</span>
                <button
                  type="button"
                  onClick={() =>
                    setReaderConfig({
                      ...readerConfig,
                      commentingBehavior: {
                        ...readerConfig.commentingBehavior,
                        enabled: !readerConfig.commentingBehavior.enabled,
                      },
                    })
                  }
                  className={cn(
                    'relative w-12 h-6 rounded-full transition-colors',
                    readerConfig.commentingBehavior.enabled
                      ? 'bg-primary-600'
                      : 'bg-surface-300'
                  )}
                >
                  <span
                    className={cn(
                      'absolute top-1 w-4 h-4 bg-white rounded-full transition-transform',
                      readerConfig.commentingBehavior.enabled
                        ? 'left-7'
                        : 'left-1'
                    )}
                  />
                </button>
              </label>
            </div>

            {/* 评论概率 */}
            <div className="mb-4">
              <label className="block text-sm text-gray-600 mb-2">
                评论概率：{(readerConfig.commentingBehavior.commentProbability * 100).toFixed(0)}%
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={readerConfig.commentingBehavior.commentProbability}
                onChange={(e) =>
                  setReaderConfig({
                    ...readerConfig,
                    commentingBehavior: {
                      ...readerConfig.commentingBehavior,
                      commentProbability: parseFloat(e.target.value),
                    },
                  })
                }
                className="w-full"
                disabled={!readerConfig.commentingBehavior.enabled}
              />
              <div className="flex justify-between text-xs text-surface-400 mt-1">
                <span>沉默寡言</span>
                <span>话痨评论</span>
              </div>
            </div>

            {/* 触发评论的评分阈值 */}
            <div>
              <label className="block text-sm text-gray-600 mb-2">
                触发评论的评分阈值：{readerConfig.commentingBehavior.ratingThreshold.toFixed(0)} 分
              </label>
              <input
                type="range"
                min="1"
                max="10"
                step="1"
                value={readerConfig.commentingBehavior.ratingThreshold}
                onChange={(e) =>
                  setReaderConfig({
                    ...readerConfig,
                    commentingBehavior: {
                      ...readerConfig.commentingBehavior,
                      ratingThreshold: parseFloat(e.target.value),
                    },
                  })
                }
                className="w-full"
                disabled={!readerConfig.commentingBehavior.enabled}
              />
              <div className="flex justify-between text-xs text-surface-400 mt-1">
                <span>1 分（评分即评）</span>
                <span>10 分（好评才评）</span>
              </div>
            </div>
          </div>

          {/* 互动行为 */}
          <div className="bg-surface-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <Gift className="w-4 h-4 text-primary-600" />
              <h3 className="font-medium">互动行为</h3>
            </div>

            {/* 是否催更 */}
            <div className="mb-4">
              <label className="flex items-center justify-between py-2">
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-orange-500" />
                  <span className="text-sm text-gray-600">是否催更</span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setReaderConfig({
                      ...readerConfig,
                      interactionBehavior: {
                        ...readerConfig.interactionBehavior,
                        pokeEnabled: !readerConfig.interactionBehavior.pokeEnabled,
                      },
                    })
                  }
                  className={cn(
                    'relative w-12 h-6 rounded-full transition-colors',
                    readerConfig.interactionBehavior.pokeEnabled
                      ? 'bg-primary-600'
                      : 'bg-surface-300'
                  )}
                >
                  <span
                    className={cn(
                      'absolute top-1 w-4 h-4 bg-white rounded-full transition-transform',
                      readerConfig.interactionBehavior.pokeEnabled
                        ? 'left-7'
                        : 'left-1'
                    )}
                  />
                </button>
              </label>
            </div>

            {/* 是否打赏 */}
            <div>
              <label className="flex items-center justify-between py-2">
                <div className="flex items-center gap-2">
                  <Gift className="w-4 h-4 text-red-500" />
                  <span className="text-sm text-gray-600">是否打赏</span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setReaderConfig({
                      ...readerConfig,
                      interactionBehavior: {
                        ...readerConfig.interactionBehavior,
                        giftEnabled: !readerConfig.interactionBehavior.giftEnabled,
                      },
                    })
                  }
                  className={cn(
                    'relative w-12 h-6 rounded-full transition-colors',
                    readerConfig.interactionBehavior.giftEnabled
                      ? 'bg-primary-600'
                      : 'bg-surface-300'
                  )}
                >
                  <span
                    className={cn(
                      'absolute top-1 w-4 h-4 bg-white rounded-full transition-transform',
                      readerConfig.interactionBehavior.giftEnabled
                        ? 'left-7'
                        : 'left-1'
                    )}
                  />
                </button>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* 保存按钮 */}
      <Button onClick={handleSave} disabled={saving} className="w-full py-3">
        {saving ? '保存中...' : isFirstLogin ? '开始创作' : '保存配置'}
      </Button>
    </div>
  );
}
