import { User, Bot, MapPin, Check, Heart, ThumbsUp, ThumbsDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CommentItemProps {
  comment: {
    id: string;
    content: string;
    isHuman: boolean;
    aiRole?: string;
    rating?: number;      // 1-10 分
    praise?: string;     // 赞扬内容
    critique?: string;   // 批评内容
    isAdopted: boolean;
    chapterId?: string;
    chapter?: {
      chapterNumber: number;
    };
    user?: {
      nickname: string;
      avatar?: string;
    };
    createdAt: string;
  };
}

/**
 * 评论项组件
 * 设计原则：高亮区分 [人类评论] 和 [AI 书评]，听劝标记
 */
export function CommentItem({ comment }: CommentItemProps) {
  // 判断是否是 AI 读者评论（有 praise 或 critique）
  const isAiReader = !comment.isHuman && (comment.praise || comment.critique);

  return (
    <div
      className={cn(
        'p-5 rounded-2xl transition-all duration-300 border',
        comment.isAdopted
          ? 'bg-amber-50/50 dark:bg-amber-900/20 border-amber-200/50 dark:border-amber-800/30'
          : comment.isHuman
            ? 'bg-gradient-to-r from-primary-50/50 to-transparent border-l-4 border-l-primary-400'
            : 'bg-gradient-to-r from-purple-50/50 to-transparent border-l-4 border-l-purple-400'
      )}
    >
      {/* 用户信息 */}
      <div className="flex items-center gap-3 mb-4">
        <div
          className={cn(
            'w-10 h-10 rounded-full flex items-center justify-center ring-2 ring-white shadow-sm',
            comment.isHuman
              ? 'bg-gradient-to-br from-blue-400 to-blue-600'
              : 'bg-gradient-to-br from-purple-400 to-purple-600'
          )}
        >
          {comment.isHuman ? (
            <User className="w-5 h-5 text-white" />
          ) : (
            <Bot className="w-5 h-5 text-white" />
          )}
        </div>

        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-900 dark:text-gray-100">
              @{comment.user?.nickname || `${comment.aiRole}Reader`}
            </span>
            {comment.isHuman ? (
              <span className="text-xs px-2.5 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-full font-medium">
                人类
              </span>
            ) : (
              <span className="text-xs px-2.5 py-0.5 bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 rounded-full font-medium">
                AI 读者
              </span>
            )}
            {/* 显示评分（直接使用 1-10 分） */}
            {comment.rating !== undefined && comment.rating !== null && (
              <span className="flex items-center gap-0.5 text-xs text-red-500 font-medium">
                <Heart className="w-3.5 h-3.5 fill-current" />
                {comment.rating.toFixed(1)}/10
              </span>
            )}
          </div>
        </div>

        {/* 采纳标记 */}
        {comment.isAdopted && (
          <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-3 py-1 rounded-full font-medium">
            <Check className="w-3 h-3" />
            已采纳
          </span>
        )}
      </div>

      {/* 评论内容 - AI 读者分开展示 praise 和 critique */}
      {isAiReader ? (
        <div className="space-y-3">
          {/* 赞扬 */}
          {comment.praise && (
            <div className="bg-green-50/70 dark:bg-green-900/20 rounded-xl p-4 border border-green-100 dark:border-green-800/30">
              <div className="flex items-center gap-1.5 text-green-700 dark:text-green-400 text-xs font-semibold mb-2">
                <ThumbsUp className="w-3.5 h-3.5" />
                赞扬
              </div>
              <div className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
                {comment.praise}
              </div>
            </div>
          )}
          {/* 批评/建议 */}
          {comment.critique && (
            <div className="bg-red-50/70 dark:bg-red-900/20 rounded-xl p-4 border border-red-100 dark:border-red-800/30">
              <div className="flex items-center gap-1.5 text-red-700 dark:text-red-400 text-xs font-semibold mb-2">
                <ThumbsDown className="w-3.5 h-3.5" />
                建议
              </div>
              <div className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
                {comment.critique}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* 人类评论或旧版 AI 评论 - 显示原始 content */
        <div className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed pl-1">
          {comment.content}
        </div>
      )}

      {/* 章节位置 */}
      {comment.chapter && (
        <div className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500 mt-4">
          <MapPin className="w-3 h-3" />
          <span>第 {comment.chapter.chapterNumber} 章</span>
        </div>
      )}

      {/* 时间 */}
      <div className="text-xs text-gray-400 dark:text-gray-500 mt-2">
        {formatTime(comment.createdAt)}
      </div>
    </div>
  );
}

function formatTime(time: string | Date): string {
  const date = time instanceof Date ? time : new Date(time);
  if (isNaN(date.getTime())) {
    return '刚刚';
  }
  return date.toLocaleString('zh-CN');
}
