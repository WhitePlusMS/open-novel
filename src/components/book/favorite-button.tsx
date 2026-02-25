'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Bookmark } from 'lucide-react';
import { useAuth } from '@/components/auth-provider';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';

interface FavoriteButtonProps {
  bookId: string;
}

/**
 * 加入书架按钮组件
 * 支持点击添加/取消收藏
 */
export function FavoriteButton({ bookId }: FavoriteButtonProps) {
  const { user, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();
  const { success, error: showError, warning } = useToast();
  const [isFavorited, setIsFavorited] = useState(false);
  const [isLoadingState, setIsLoadingState] = useState(false);

  // 获取当前收藏状态
  useEffect(() => {
    if (!user) return;

    const fetchFavoriteStatus = async () => {
      try {
        const response = await fetch(`/api/books/${bookId}/favorite/status`);
        const result = await response.json();
        if (result.code === 0 && result.data) {
          setIsFavorited(result.data.isFavorited);
        }
      } catch (error) {
        console.error('[FavoriteButton] Failed to fetch favorite status:', error);
      }
    };

    fetchFavoriteStatus();
  }, [bookId, user]);

  const handleToggle = async () => {
    if (!user || isAuthLoading) return;

    setIsLoadingState(true);
    try {
      const response = await fetch(`/api/books/${bookId}/favorite`, {
        method: 'POST',
      });
      const result = await response.json();
      if (result.code === 0) {
        setIsFavorited(result.data.favorited);
        // 显示 toast 提示
        if (result.data.favorited) {
          success('已加入书架');
        } else {
          success('已移出书架');
        }
        // 刷新页面以更新书架数据
        router.refresh();
      } else if (result.code === 401) {
        warning('请先登录后再收藏');
      }
    } catch (error) {
      console.error('[FavoriteButton] Failed to toggle favorite:', error);
      showError('操作失败，请稍后重试');
    } finally {
      setIsLoadingState(false);
    }
  };

  // 未登录时禁用
  if (!user && !isAuthLoading) {
    return (
      <button
        disabled
        aria-label="加入书架（请先登录）"
        className="px-4 py-3 border border-surface-300 dark:border-surface-600 rounded-lg text-surface-300 dark:text-surface-500 cursor-not-allowed flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-primary-500"
      >
        <Bookmark className="w-5 h-5" aria-hidden="true" />
      </button>
    );
  }

  return (
    <button
      onClick={handleToggle}
      disabled={isLoadingState}
      aria-label={isFavorited ? "取消收藏" : "加入书架"}
      className={cn(
        'px-4 py-3 border rounded-lg transition-all flex items-center justify-center gap-2',
        'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
        isFavorited
          ? 'border-primary-500 bg-primary-50 text-primary-600 dark:bg-primary-900/20 dark:border-primary-500 dark:text-primary-400'
          : 'border-surface-300 hover:bg-surface-50 dark:border-surface-600 dark:hover:bg-surface-800 dark:text-surface-300',
        isLoadingState && 'opacity-50 cursor-wait'
      )}
    >
      <Bookmark
        className={cn(
          'w-5 h-5',
          isFavorited && 'fill-current'
        )}
        aria-hidden="true"
      />
    </button>
  );
}
