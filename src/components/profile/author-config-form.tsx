/**
 * 作者配置表单组件
 */

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { BookOpen, Pen, Star, User } from 'lucide-react';
import type { AuthorConfig } from '@/types/agent-config';
import {
  AUTHOR_PERSONALITIES,
  WRITING_STYLES,
  GENRES,
  WRITING_LENGTH_OPTIONS,
  WORD_COUNTS,
} from '@/config/agent-config';

interface AuthorConfigFormProps {
  config: AuthorConfig;
  importing: boolean;
  onConfigChange: (config: AuthorConfig) => void;
  onImportFromSecondMe: () => void;
}

export function AuthorConfigForm({
  config,
  importing,
  onConfigChange,
  onImportFromSecondMe,
}: AuthorConfigFormProps) {
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
          选择或输入你的创作性格，点击选项可直接填入
        </p>
        <div className="flex flex-wrap gap-2 mb-3">
          {AUTHOR_PERSONALITIES.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => onConfigChange({ ...config, writerPersonality: item.value })}
              className={cn(
                'px-3 py-1.5 rounded-full text-sm transition-all',
                config.writerPersonality === item.value
                  ? 'bg-primary-600 text-white'
                  : 'bg-white dark:bg-gray-700 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-600 border border-surface-200 dark:border-surface-600'
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
        <textarea
          value={config.writerPersonality}
          onChange={(e) => onConfigChange({ ...config, writerPersonality: e.target.value })}
          rows={6}
          className="w-full px-3 py-2 border border-surface-200 dark:border-surface-600 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          placeholder="或自定义输入你的性格描述..."
        />
      </div>

      {/* 写作风格 */}
      <div className="bg-surface-50 dark:bg-surface-800 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <Pen className="w-4 h-4 text-primary-600" />
          <h3 className="font-medium">写作风格</h3>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {WRITING_STYLES.map((style) => (
            <button
              key={style.value}
              type="button"
              onClick={() => onConfigChange({ ...config, writingStyle: style.value })}
              className={cn(
                'p-3 border rounded-lg text-left transition-all',
                config.writingStyle === style.value
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30'
                  : 'border-surface-200 dark:border-surface-600 hover:border-surface-300 dark:hover:border-surface-500 bg-white dark:bg-gray-700'
              )}
            >
              <div className="font-medium text-gray-900 dark:text-gray-100">{style.label}</div>
              <div className="text-xs text-surface-500 dark:text-surface-400 mt-1">
                {style.description}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* 听劝指数 */}
      <div className="bg-surface-50 dark:bg-surface-800 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <Star className="w-4 h-4 text-orange-500" />
          <h3 className="font-medium">听劝指数</h3>
        </div>
        <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">
          听劝指数：{(config.adaptability ?? 0.8).toFixed(1)}
        </label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={config.adaptability}
          onChange={(e) => onConfigChange({ ...config, adaptability: parseFloat(e.target.value) })}
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
      <div className="bg-surface-50 dark:bg-surface-800 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <BookOpen className="w-4 h-4 text-primary-600" />
          <h3 className="font-medium">偏好题材</h3>
        </div>
        <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">
          偏好题材（可多选）
        </label>
        <div className="flex flex-wrap gap-2">
          {GENRES.map((genre) => (
            <button
              key={genre}
              type="button"
              onClick={() => {
                const genres = config.preferredGenres.includes(genre)
                  ? config.preferredGenres.filter((g) => g !== genre)
                  : [...config.preferredGenres, genre];
                onConfigChange({ ...config, preferredGenres: genres });
              }}
              className={cn(
                'px-3 py-1 rounded-full text-sm transition-all',
                config.preferredGenres.includes(genre)
                  ? 'bg-primary-600 text-white'
                  : 'bg-white dark:bg-gray-700 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-600 border border-surface-200 dark:border-surface-600'
              )}
            >
              {genre}
            </button>
          ))}
        </div>
      </div>

      {/* 创作风格 */}
      <div className="bg-surface-50 dark:bg-surface-800 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <BookOpen className="w-4 h-4 text-primary-600" />
          <h3 className="font-medium">创作风格</h3>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {WRITING_LENGTH_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onConfigChange({ ...config, writingLengthPreference: option.value })}
              className={cn(
                'py-3 border rounded-lg text-sm transition-all',
                config.writingLengthPreference === option.value
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                  : 'border-surface-200 dark:border-surface-600 hover:border-surface-300 dark:hover:border-surface-500 bg-white dark:bg-gray-700'
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* 每章目标字数 */}
      <div className="bg-surface-50 dark:bg-surface-800 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <Pen className="w-4 h-4 text-primary-600" />
          <h3 className="font-medium">每章目标字数</h3>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {WORD_COUNTS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onConfigChange({ ...config, wordCountTarget: option.value })}
              className={cn(
                'py-2 border rounded-lg text-sm transition-all',
                config.wordCountTarget === option.value
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                  : 'border-surface-200 dark:border-surface-600 hover:border-surface-300 dark:hover:border-surface-500 bg-white dark:bg-gray-700'
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
