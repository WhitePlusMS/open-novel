/**
 * 赛季队列列表组件
 */

import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Play, Calendar, Edit3, Sparkles, Trash2 } from 'lucide-react';
import type { SeasonQueueItem } from '@/types/season-admin';
import { getStatusBadge, formatConstraints, formatZoneStyles, parseLLMSuggestion } from '@/lib/season-admin-utils';

interface SeasonQueueListProps {
  seasonQueue: SeasonQueueItem[];
  loading: boolean;
  isProcessing: boolean;
  optimizingItem: string | null;
  onEdit: (item: SeasonQueueItem) => void;
  onDelete: (id: string) => void;
  onLLMOptimize: (item: SeasonQueueItem) => void;
  onBatchPublish: (count: number) => void;
}

export function SeasonQueueList({
  seasonQueue,
  loading,
  isProcessing,
  optimizingItem,
  onEdit,
  onDelete,
  onLLMOptimize,
  onBatchPublish,
}: SeasonQueueListProps) {
  if (loading) {
    return (
      <div className="p-4 bg-surface-50 dark:bg-surface-800 rounded-lg border border-surface-200 dark:border-surface-700">
        <div className="text-center py-8">
          <Spinner className="w-6 h-6 mx-auto" />
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-2">加载中...</p>
        </div>
      </div>
    );
  }

  if (seasonQueue.length === 0) {
    return (
      <div className="p-4 bg-surface-50 dark:bg-surface-800 rounded-lg border border-surface-200 dark:border-surface-700">
        <div className="text-center py-8 text-surface-500 dark:text-surface-400">
          <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>队列为空，点击上方添加赛季</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-surface-50 dark:bg-surface-800 rounded-lg border border-surface-200 dark:border-surface-700">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium text-gray-900 dark:text-gray-100">
          赛季队列 ({seasonQueue.length})
        </h3>
        {seasonQueue.length > 0 && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onBatchPublish(1)}
              disabled={isProcessing}
              className="gap-1"
            >
              <Play className="w-3 h-3" />
              发布1个
            </Button>
            {seasonQueue.length > 1 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onBatchPublish(seasonQueue.length)}
                disabled={isProcessing}
                className="gap-1"
              >
                <Play className="w-3 h-3" />
                发布全部
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="space-y-3">
        {seasonQueue.map((item) => (
          <SeasonQueueItemCard
            key={item.id}
            item={item}
            optimizingItem={optimizingItem}
            onEdit={onEdit}
            onDelete={onDelete}
            onLLMOptimize={onLLMOptimize}
          />
        ))}
      </div>
    </div>
  );
}

interface SeasonQueueItemCardProps {
  item: SeasonQueueItem;
  optimizingItem: string | null;
  onEdit: (item: SeasonQueueItem) => void;
  onDelete: (id: string) => void;
  onLLMOptimize: (item: SeasonQueueItem) => void;
}

function SeasonQueueItemCard({
  item,
  optimizingItem,
  onEdit,
  onDelete,
  onLLMOptimize,
}: SeasonQueueItemCardProps) {
  return (
    <div className="p-3 bg-white dark:bg-surface-700 rounded-lg border border-surface-200 dark:border-surface-600">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium">S{item.seasonNumber}</span>
            <span className="font-semibold">{item.themeKeyword}</span>
            {getStatusBadge(item.status)}
            {item.llmOptimized && (
              <Sparkles className="w-4 h-4 text-amber-500" />
            )}
          </div>
          <div className="text-xs text-surface-500 dark:text-surface-400 space-y-1">
            <div>
              约束：{formatConstraints(item.constraints)}
            </div>
            <div className="flex gap-4">
              <span>分区：{formatZoneStyles(item.zoneStyles)}</span>
              <span>章节：{item.minChapters}-{item.maxChapters} 章</span>
              <span>时长：{item.roundDuration}分钟/轮</span>
            </div>
            {item.plannedStartTime && (
              <div>
                计划开始：{new Date(item.plannedStartTime).toLocaleString()}
                <span className="ml-2">(间隔{item.intervalHours}小时)</span>
              </div>
            )}
          </div>
          {/* LLM 建议显示 */}
          {item.llmSuggestion && (
            <div className="mt-2 p-2 bg-amber-50 dark:bg-amber-900/20 rounded text-xs text-amber-800 dark:text-amber-200">
              <div className="flex items-center gap-1 mb-1">
                <Sparkles className="w-3 h-3" />
                <span className="font-medium">AI 优化建议</span>
              </div>
              <pre className="whitespace-pre-wrap font-sans">
                {parseLLMSuggestion(item.llmSuggestion)}
              </pre>
            </div>
          )}
        </div>
        <div className="flex gap-1 ml-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onEdit(item)}
            className="w-8 h-8"
            title="编辑"
          >
            <Edit3 className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onLLMOptimize(item)}
            disabled={optimizingItem === item.id}
            className="w-8 h-8"
            title="AI 优化"
          >
            {optimizingItem === item.id ? (
              <Spinner className="w-4 h-4" />
            ) : (
              <Sparkles className="w-4 h-4 text-amber-500" />
            )}
          </Button>
          {item.status !== 'PUBLISHED' && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDelete(item.id)}
              className="w-8 h-8 text-red-500"
              title="删除"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
