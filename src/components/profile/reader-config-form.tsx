/**
 * 读者配置表单组件
 */

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { BookOpen, Eye, MessageCircle, Gift, Star, User } from 'lucide-react';
import type { ReaderConfig } from '@/types/agent-config';
import { GENRES, COMMENT_FOCUS_OPTIONS } from '@/config/agent-config';

interface ReaderConfigFormProps {
  config: ReaderConfig;
  importing: boolean;
  onConfigChange: (config: ReaderConfig) => void;
  onImportFromSecondMe: () => void;
}

export function ReaderConfigForm({
  config,
  importing,
  onConfigChange,
  onImportFromSecondMe,
}: ReaderConfigFormProps) {
  return (
    <div className="space-y-6">
      {/* 性格描述 */}
      <div className="bg-surface-50 dark:bg-surface-800 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-primary-600" />
            <h3 className="font-medium">性格描述</h3>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onImportFromSecondMe}
            loading={importing}
            className="text-xs"
          >
            <User className="w-3 h-3 mr-1" />
            从 SecondMe 导入
          </Button>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          选择或输入你的性格特点，点击选项可直接填入
        </p>
        <div className="flex flex-wrap gap-2 mb-3">
          {[
            { value: '毒舌但有理，评价犀利直接，一针见血', label: '毒舌犀利' },
            { value: '温柔敦厚，鼓励为主，点评温和有耐心', label: '温柔鼓励' },
            { value: '客观中肯，理性分析，优缺点都讲', label: '客观理性' },
            { value: '严厉严格，标准高，追求完美', label: '严厉严格' },
            { value: '幽默风趣，评论活泼有趣，调侃为主', label: '幽默风趣' },
            { value: '专业资深，老书虫，点评深入透彻', label: '专业资深' },
          ].map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => onConfigChange({ ...config, readerPersonality: item.value })}
              className={cn(
                'px-3 py-1.5 rounded-full text-sm transition-all',
                config.readerPersonality === item.value
                  ? 'bg-primary-600 text-white'
                  : 'bg-white dark:bg-gray-700 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-600 border border-surface-200 dark:border-surface-600'
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
        <textarea
          value={config.readerPersonality}
          onChange={(e) => onConfigChange({ ...config, readerPersonality: e.target.value })}
          placeholder="或自定义输入你的性格描述..."
          className="w-full px-3 py-2 border border-surface-200 dark:border-surface-600 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          rows={6}
        />
      </div>

      {/* 阅读偏好 */}
      <div className="bg-surface-50 dark:bg-surface-800 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <Eye className="w-4 h-4 text-primary-600" />
          <h3 className="font-medium">阅读偏好</h3>
        </div>

        {/* 偏好题材 */}
        <div className="mb-4">
          <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">
            偏好题材（可多选）
          </label>
          <div className="flex flex-wrap gap-2">
            {GENRES.map((genre) => (
              <button
                key={genre}
                type="button"
                onClick={() => {
                  const genres = config.readingPreferences.preferredGenres.includes(genre)
                    ? config.readingPreferences.preferredGenres.filter((g) => g !== genre)
                    : [...config.readingPreferences.preferredGenres, genre];
                  onConfigChange({
                    ...config,
                    readingPreferences: { ...config.readingPreferences, preferredGenres: genres },
                  });
                }}
                className={cn(
                  'px-3 py-1 rounded-full text-sm transition-all',
                  config.readingPreferences.preferredGenres.includes(genre)
                    ? 'bg-primary-600 text-white'
                    : 'bg-white dark:bg-gray-700 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-600 border border-surface-200 dark:border-surface-600'
                )}
              >
                {genre}
              </button>
            ))}
          </div>
        </div>

        {/* 评价侧重点 */}
        <div className="mb-4">
          <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">
            评价侧重点（可多选）
          </label>
          <div className="flex flex-wrap gap-2">
            {COMMENT_FOCUS_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  const currentFocus = config.readingPreferences.commentFocus || [];
                  const newFocus = currentFocus.includes(option.value)
                    ? currentFocus.filter((f) => f !== option.value)
                    : [...currentFocus, option.value];
                  const finalFocus = newFocus.length === 0 ? ['综合'] : newFocus;
                  onConfigChange({
                    ...config,
                    readingPreferences: { ...config.readingPreferences, commentFocus: finalFocus },
                  });
                }}
                className={cn(
                  'px-3 py-1 rounded-full text-sm transition-all',
                  (config.readingPreferences.commentFocus || ['综合']).includes(option.value)
                    ? 'bg-primary-600 text-white'
                    : 'bg-white dark:bg-gray-700 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-600 border border-surface-200 dark:border-surface-600'
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
          <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">
            最低评分阈值：{(config.readingPreferences?.minRatingThreshold ?? 3.0).toFixed(1)} 分
          </label>
          <input
            type="range"
            min="1"
            max="5"
            step="0.5"
            value={config.readingPreferences.minRatingThreshold}
            onChange={(e) =>
              onConfigChange({
                ...config,
                readingPreferences: {
                  ...config.readingPreferences,
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
      <div className="bg-surface-50 dark:bg-surface-800 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <MessageCircle className="w-4 h-4 text-primary-600" />
          <h3 className="font-medium">评论行为</h3>
        </div>

        {/* 是否开启评论 */}
        <div className="mb-4">
          <label className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">是否开启评论</span>
            <button
              type="button"
              onClick={() =>
                onConfigChange({
                  ...config,
                  commentingBehavior: { ...config.commentingBehavior, enabled: !config.commentingBehavior.enabled },
                })
              }
              className={cn(
                'relative w-12 h-6 rounded-full transition-colors',
                config.commentingBehavior.enabled ? 'bg-primary-600' : 'bg-surface-300'
              )}
            >
              <span
                className={cn(
                  'absolute top-1 w-4 h-4 bg-white rounded-full transition-transform',
                  config.commentingBehavior.enabled ? 'left-7' : 'left-1'
                )}
              />
            </button>
          </label>
        </div>

        {/* 评论概率 */}
        <div className="mb-4">
          <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">
            评论概率：{((config.commentingBehavior?.commentProbability ?? 0.5) * 100).toFixed(0)}%
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={config.commentingBehavior.commentProbability}
            onChange={(e) =>
              onConfigChange({
                ...config,
                commentingBehavior: { ...config.commentingBehavior, commentProbability: parseFloat(e.target.value) },
              })
            }
            className="w-full"
            disabled={!config.commentingBehavior.enabled}
          />
          <div className="flex justify-between text-xs text-surface-400 mt-1">
            <span>沉默寡言</span>
            <span>话痨评论</span>
          </div>
        </div>

        {/* 触发评论的评分阈值 */}
        <div>
          <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">
            触发评论的评分阈值：{(config.commentingBehavior?.ratingThreshold ?? 6).toFixed(0)} 分
          </label>
          <input
            type="range"
            min="1"
            max="10"
            step="1"
            value={config.commentingBehavior?.ratingThreshold ?? 6}
            onChange={(e) =>
              onConfigChange({
                ...config,
                commentingBehavior: { ...config.commentingBehavior, ratingThreshold: parseFloat(e.target.value) },
              })
            }
            className="w-full"
            disabled={!config.commentingBehavior.enabled}
          />
          <div className="flex justify-between text-xs text-surface-400 mt-1">
            <span>1 分（评分即评）</span>
            <span>10 分（好评才评）</span>
          </div>
        </div>
      </div>

      {/* 互动行为 */}
      <div className="bg-surface-50 dark:bg-surface-800 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <Gift className="w-4 h-4 text-primary-600" />
          <h3 className="font-medium">互动行为</h3>
        </div>

        {/* 是否催更 */}
        <div className="mb-4">
          <label className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2">
              <Star className="w-4 h-4 text-orange-500" />
              <span className="text-sm text-gray-600 dark:text-gray-400">是否催更</span>
            </div>
            <button
              type="button"
              onClick={() =>
                onConfigChange({
                  ...config,
                  interactionBehavior: { ...config.interactionBehavior, pokeEnabled: !config.interactionBehavior.pokeEnabled },
                })
              }
              className={cn(
                'relative w-12 h-6 rounded-full transition-colors',
                config.interactionBehavior.pokeEnabled ? 'bg-primary-600' : 'bg-surface-300'
              )}
            >
              <span
                className={cn(
                  'absolute top-1 w-4 h-4 bg-white rounded-full transition-transform',
                  config.interactionBehavior.pokeEnabled ? 'left-7' : 'left-1'
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
              <span className="text-sm text-gray-600 dark:text-gray-400">是否打赏</span>
            </div>
            <button
              type="button"
              onClick={() =>
                onConfigChange({
                  ...config,
                  interactionBehavior: { ...config.interactionBehavior, giftEnabled: !config.interactionBehavior.giftEnabled },
                })
              }
              className={cn(
                'relative w-12 h-6 rounded-full transition-colors',
                config.interactionBehavior.giftEnabled ? 'bg-primary-600' : 'bg-surface-300'
              )}
            >
              <span
                className={cn(
                  'absolute top-1 w-4 h-4 bg-white rounded-full transition-transform',
                  config.interactionBehavior.giftEnabled ? 'left-7' : 'left-1'
                )}
              />
            </button>
          </label>
        </div>
      </div>
    </div>
  );
}
